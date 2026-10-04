import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/AppText';
import { travelVoiceToken } from '../backend/voice';
import { useAuth } from './AuthContext';
import { useRide } from './RideContext';
import { useOperator } from './OperatorContext';
import { useLanguage } from './LanguageContext';
import { colors } from '../theme';
import type { Voice as NativeVoice, Call, CallInvite } from '@twilio/voice-react-native-sdk';

const configured = process.env.EXPO_PUBLIC_NATIVE_VOICE_ENABLED === 'true' && Platform.OS !== 'web';
type CallState = { available: boolean; activeId: string | null; start: (id: string) => Promise<void> };
const Context = createContext<CallState>({ available: false, activeId: null, start: async () => {} });
export const useTravelVoice = () => useContext(Context);

/** VoIP never silently claims a call. The switch remains off until native signing, APNs,
 * FCM, Twilio credentials, entitlements and physical-device drills are commissioned. */
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const ride = useRide();
  const op = useOperator();
  const { t } = useLanguage();
  const activeId = user && (op.op?.rideId || (ride.rideActive && ride.matchedOp?.rideId) || null) || null;
  const activeRef = useRef<string | null>(activeId);
  activeRef.current = activeId;
  const sdk = useRef<NativeVoice | null>(null);
  const current = useRef<Call | null>(null);
  const connecting = useRef(false);
  const inviteRef = useRef<CallInvite | null>(null);
  const [registeredFor, setRegisteredFor] = useState<string | null>(null);
  const [invite, setInvite] = useState<CallInvite | null>(null);
  const [inCall, setInCall] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);

  const watchCall = useCallback((call: Call) => {
    const { Call: NativeCall } = require('@twilio/voice-react-native-sdk') as typeof import('@twilio/voice-react-native-sdk');
    current.current = call;
    setInCall(true);
    setConnected(false);
    setBusy(false);
    call.on(NativeCall.Event.Connected, () => { if (current.current === call) setConnected(true); });
    call.on(NativeCall.Event.Disconnected, () => { if (current.current === call) { current.current = null; setInCall(false); setConnected(false); } });
    call.on(NativeCall.Event.ConnectFailure, () => { if (current.current === call) { current.current = null; setInCall(false); setConnected(false); setProblem(true); } });
  }, []);

  useEffect(() => {
    if (!configured || !activeId) {
      setRegisteredFor(null);
      return;
    }
    setRegisteredFor(null);
    let mounted = true;
    let token: string | null = null;
    const { Voice } = require('@twilio/voice-react-native-sdk') as typeof import('@twilio/voice-react-native-sdk');
    const voice = sdk.current || new Voice();
    sdk.current = voice;
    const onInvite = (next: CallInvite) => {
      const expected = activeRef.current;
      // SDK push is external input. Reject an invite for an old or other Travel.
      const from = String(next.getFrom() || '').replace(/^client:/, '');
      if (!expected || current.current || inviteRef.current ||
          !new RegExp(`^ar_${expected}_[a-f0-9]{24}_(?:traveler|operator)$`).test(from)) {
        void next.reject().catch(() => {});
        return;
      }
      inviteRef.current = next;
      setInvite(next);
    };
    const onError = () => { if (mounted) { setRegisteredFor(null); setProblem(true); } };
    voice.on(Voice.Event.CallInvite, onInvite);
    voice.on(Voice.Event.Error, onError);
    const register = async () => {
      try {
        const authorized = await travelVoiceToken(activeId);
        if (!mounted) return;
        await voice.register(authorized.token);
        if (!mounted) { await voice.unregister(authorized.token).catch(() => {}); return; }
        token = authorized.token;
        setRegisteredFor(activeId);
        setProblem(false);
      } catch { if (mounted) { setRegisteredFor(null); setProblem(true); } }
    };
    void register();
    // Access tokens expire after one hour. Refresh before expiry while the Travel remains active.
    const refresh = setInterval(() => { if (mounted) void register(); }, 35 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(refresh);
      voice.removeListener(Voice.Event.CallInvite, onInvite);
      voice.removeListener(Voice.Event.Error, onError);
      if (token) void voice.unregister(token).catch(() => {});
      if (inviteRef.current) void inviteRef.current.reject().catch(() => {});
      inviteRef.current = null;
      setInvite(null);
      if (current.current) void current.current.disconnect().catch(() => {});
      current.current = null;
      setInCall(false);
      setConnected(false);
      setRegisteredFor(null);
    };
  }, [activeId]);

  const start = useCallback(async (id: string) => {
    if (!configured || registeredFor !== id || !sdk.current || id !== activeRef.current || connecting.current || current.current) return;
    connecting.current = true;
    setBusy(true);
    setProblem(false);
    try {
      const authorized = await travelVoiceToken(id); // recheck live eligibility at each call
      if (id !== activeRef.current) return;
      const other = authorized.side === 'operator' ? 'traveler' : 'operator';
      const counterpart = authorized.identity.replace(/_(?:operator|traveler)$/, `_${other}`);
      const call = await sdk.current.connect(authorized.token, {
        params: { To: `client:${counterpart}` },
        contactHandle: 'American Rider Travel', notificationDisplayName: 'American Rider Travel',
      });
      if (id !== activeRef.current) { await call.disconnect(); return; }
      watchCall(call);
    } catch { setProblem(true); }
    finally { connecting.current = false; setBusy(false); }
  }, [registeredFor, watchCall]);

  const answer = async () => {
    const pending = inviteRef.current;
    if (!pending || busy || !activeRef.current) return;
    setBusy(true); setInvite(null); inviteRef.current = null;
    try { watchCall(await pending.accept()); }
    catch { setProblem(true); }
    finally { setBusy(false); }
  };
  const reject = () => {
    const pending = inviteRef.current;
    inviteRef.current = null; setInvite(null);
    if (pending) void pending.reject().catch(() => setProblem(true));
  };
  const end = () => { const call = current.current; if (call) void call.disconnect().catch(() => setProblem(true)); };

  return <Context.Provider value={{ available: configured && registeredFor === activeId && !!activeId, activeId, start }}>
    {children}
    {configured && (invite || inCall || busy || problem) && <View style={styles.cover} pointerEvents="box-none">
      <View style={styles.sheet} accessibilityRole="alert">
        <Text style={styles.heading}>{invite ? t('common.voiceIncoming') : inCall ? t(connected ? 'common.voiceActive' : 'common.voiceConnecting') : busy ? t('common.voiceConnecting') : t('common.voiceFailed')}</Text>
        {invite ? <View style={styles.actions}>
          <Pressable accessibilityRole="button" style={styles.action} onPress={() => { void answer(); }}><Text>{t('common.voiceAnswer')}</Text></Pressable>
          <Pressable accessibilityRole="button" style={styles.action} onPress={reject}><Text>{t('common.voiceReject')}</Text></Pressable>
        </View> : inCall ? <Pressable accessibilityRole="button" style={styles.action} onPress={end}><Text>{t('common.voiceEnd')}</Text></Pressable>
          : problem ? <Pressable accessibilityRole="button" style={styles.action} onPress={() => setProblem(false)}><Text>{t('common.done')}</Text></Pressable> : null}
      </View>
    </View>}
  </Context.Provider>;
}
const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 100 },
  sheet: { margin: 16, padding: 20, backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 12 },
  heading: { color: colors.ink, fontSize: 17, fontWeight: '600', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, borderColor: colors.border, borderWidth: 1 },
});
