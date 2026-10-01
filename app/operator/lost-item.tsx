import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { Card, LetterheadBar, PrimaryButton, Screen, SectionLabel, Title } from '../../src/components/UI';
import { fetchOperatorLostItem, respondOperatorLostItem, type OperatorLostItem } from '../../src/backend/operatorLostItem';
import { colors } from '../../src/theme';
import { t } from '../../src/i18n';

export default function OperatorLostItemScreen() {
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const id = String(itemId || '');
  const [item, setItem] = useState<OperatorLostItem | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [busy, setBusy] = useState<'located'|'not-found'|null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) { setError(t('operator.lostOpenFailed')); return; }
    fetchOperatorLostItem(id).then((x) => {
      setItem(x); setSelectedTrip(x.tripNo || (x.candidateTripNos.length === 1 ? x.candidateTripNos[0] : null));
    }).catch(() => setError(t('operator.lostUnavailable')));
  }, [id]);
  const needsTrip = useMemo(() => !!item && !item.tripNo && item.candidateTripNos.length > 1, [item]);
  const respond = async (outcome: 'located'|'not-found') => {
    if (!item || busy) return;
    if (outcome === 'located' && needsTrip && !selectedTrip) {
      setError(t('operator.lostSelectTravel'));
      return;
    }
    setBusy(outcome); setError(null);
    try {
      await respondOperatorLostItem(item.id, outcome, outcome === 'located' ? selectedTrip : null);
      const fresh = await fetchOperatorLostItem(item.id);
      setItem(fresh);
    } catch (e: any) {
      setError(e?.message || t('operator.lostUpdateFailed'));
    } finally { setBusy(null); }
  };
  return <Screen>
    <LetterheadBar onBack={() => router.back()} />
    <Title>{t('operator.lostTitle')}</Title>
    <Text style={styles.sub}>{t('operator.lostInstruction')}</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {item ? <>
      <SectionLabel style={styles.label}>{t('operator.lostItemLabel')}</SectionLabel>
      <Card style={styles.card}><Text style={styles.body}>{item.description}</Text>{item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.photo} /> : null}</Card>
      {needsTrip ? <>
        <SectionLabel style={styles.label}>{t('operator.lostTravelLabel')}</SectionLabel>
        <Text style={styles.sub}>{t('operator.lostTravelInstruction')}</Text>
        {item.candidateTripNos.map((no) => <Pressable key={no} onPress={() => setSelectedTrip(no)}>
          <Card style={[styles.choice, selectedTrip === no && styles.selected]}>
            <Text style={styles.body}>{selectedTrip === no ? '✓ ' : ''}{no}</Text>
          </Card>
        </Pressable>)}
      </> : item.tripNo ? <Text style={styles.trip}>{t('operator.lostTravelNumber', { no: item.tripNo })}</Text> : null}
      {item.response ? <Card style={styles.card}>
        <Text style={styles.body}>{item.response.outcome === 'located' ? t('operator.lostRecordedLocated') : t('operator.lostRecordedNotFound')}</Text>
      </Card> : <>
        <PrimaryButton label={busy === 'located' ? t('operator.lostRecording') : t('operator.lostLocated')} onPress={() => respond('located')} disabled={!!busy} style={{marginTop:24}} />
        <Pressable onPress={() => respond('not-found')} disabled={!!busy} style={styles.notFound}>
          <Text style={styles.notFoundText}>{busy === 'not-found' ? t('operator.lostRecording') : t('operator.lostNotFound')}</Text>
        </Pressable>
      </>}
    </> : null}
  </Screen>;
}
const styles=StyleSheet.create({
  sub:{fontSize:13.5,color:colors.muted,lineHeight:20,marginTop:8},
  error:{fontSize:13.5,color:colors.red,lineHeight:20,marginTop:14},
  label:{marginTop:24,marginBottom:10},
  card:{padding:18},
  body:{fontSize:14.5,color:colors.ink2,lineHeight:21},
  photo:{width:'100%',height:220,borderRadius:12,marginTop:14},
  trip:{fontSize:13.5,color:colors.muted,marginTop:16},
  choice:{padding:16,marginBottom:8},
  selected:{borderColor:colors.ink},
  notFound:{minHeight:48,alignItems:'center',justifyContent:'center',marginTop:10},
  notFoundText:{fontSize:14,fontWeight:'600',color:colors.ink},
});
