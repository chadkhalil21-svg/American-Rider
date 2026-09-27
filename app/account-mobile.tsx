import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { Text } from '../src/components/AppText';
import { Card, LetterheadBar, PrimaryButton, Screen, SectionLabel, Sub, Title } from '../src/components/UI';
import { useGoBack } from '../src/components/nav';
import { startMobileVerification, checkMobileVerification } from '../src/backend/verify';
import { useAuth } from '../src/state/AuthContext';
import { useLanguage } from '../src/state/LanguageContext';
import { db } from '../src/firebase';
import { colors } from '../src/theme';

export default function AccountMobile() {
  const goBack = useGoBack();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'number' | 'code'>('number');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        const m = snap.data()?.mobile;
        if (typeof m === 'string') setCurrent(m.trim());
      })
      .catch(() => {});
  }, [user?.uid]);

  const send = async () => {
    const next = phone.trim();
    if (!next || busy) return;
    setBusy(true);
    setError('');
    try {
      await startMobileVerification(next);
      setStage('code');
    } catch (e: any) {
      setError(e?.code === 'not_configured' ? t('traveler.verificationUnavailable') : (e?.message || t('traveler.errReachAR')));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await checkMobileVerification(phone.trim(), code.trim());
      goBack();
    } catch (e: any) {
      setError(e?.message || t('traveler.errReachAR'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <LetterheadBar onBack={goBack} />
      <Title size={24}>{t('traveler.changeMobileTitle')}</Title>
      <Sub>{t('traveler.changeMobileSub')}</Sub>

      {current ? (
        <>
          <SectionLabel style={{ marginTop: 22 }}>{t('traveler.currentNumber')}</SectionLabel>
          <Card style={styles.currentCard}>
            <Text style={styles.currentValue}>{current}</Text>
          </Card>
        </>
      ) : null}

      <SectionLabel style={{ marginTop: 22 }}>
        {stage === 'number' ? t('traveler.newMobileNumber') : t('traveler.verificationCode')}
      </SectionLabel>
      <Card style={styles.fieldCard}>
        <TextInput
          style={styles.field}
          value={stage === 'number' ? phone : code}
          onChangeText={stage === 'number' ? setPhone : setCode}
          keyboardType={stage === 'number' ? 'phone-pad' : 'number-pad'}
          autoComplete={stage === 'number' ? 'tel' : 'one-time-code'}
          textContentType={stage === 'number' ? 'telephoneNumber' : 'oneTimeCode'}
          placeholder={stage === 'number' ? '+1 (305) 555-0148' : t('traveler.enterVerificationCode')}
          placeholderTextColor={colors.faint}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={stage === 'number' ? send : verify}
        />
      </Card>
      {stage === 'code' ? (
        <Text style={styles.note}>{t('traveler.codeSentTo', { phone: phone.trim() })}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ flex: 1, minHeight: 30 }} />
      <PrimaryButton
        label={
          busy
            ? t('traveler.busyChecking')
            : stage === 'number'
              ? t('traveler.sendVerificationCode')
              : t('traveler.verifyAndSave')
        }
        disabled={busy || (stage === 'number' ? !phone.trim() : !code.trim())}
        onPress={stage === 'number' ? send : verify}
        style={{ paddingVertical: 16 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  currentCard: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 15 },
  currentValue: { fontSize: 15, fontWeight: '600', color: colors.ink },
  fieldCard: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 1 },
  field: { paddingVertical: 15, fontSize: 16, color: colors.ink },
  note: { fontSize: 12.5, color: colors.muted, lineHeight: 18, marginTop: 10 },
  error: { fontSize: 13, color: colors.red, lineHeight: 19, marginTop: 12 },
});
