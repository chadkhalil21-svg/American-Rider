import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { Card, LetterheadBar, PrimaryButton, Screen, SectionLabel, Title } from '../../src/components/UI';
import { fetchOperatorLostItem, respondOperatorLostItem, type OperatorLostItem } from '../../src/backend/operatorLostItem';
import { colors } from '../../src/theme';

export default function OperatorLostItemScreen() {
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const id = String(itemId || '');
  const [item, setItem] = useState<OperatorLostItem | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [busy, setBusy] = useState<'located'|'not-found'|null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) { setError('This report could not be opened.'); return; }
    fetchOperatorLostItem(id).then((x) => {
      setItem(x); setSelectedTrip(x.tripNo || (x.candidateTripNos.length === 1 ? x.candidateTripNos[0] : null));
    }).catch(() => setError('This lost-item report is unavailable.'));
  }, [id]);
  const needsTrip = useMemo(() => !!item && !item.tripNo && item.candidateTripNos.length > 1, [item]);
  const respond = async (outcome: 'located'|'not-found') => {
    if (!item || busy) return;
    if (outcome === 'located' && needsTrip && !selectedTrip) {
      setError('Select the Travel in which you found the item.');
      return;
    }
    setBusy(outcome); setError(null);
    try {
      await respondOperatorLostItem(item.id, outcome, outcome === 'located' ? selectedTrip : null);
      const fresh = await fetchOperatorLostItem(item.id);
      setItem(fresh);
    } catch (e: any) {
      setError(e?.message || 'This update could not be recorded.');
    } finally { setBusy(null); }
  };
  return <Screen>
    <LetterheadBar onBack={() => router.back()} />
    <Title>Lost Item</Title>
    <Text style={styles.sub}>Check the vehicle before recording an answer. Your response updates the Traveler’s report.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {item ? <>
      <SectionLabel style={styles.label}>ITEM</SectionLabel>
      <Card style={styles.card}><Text style={styles.body}>{item.description}</Text></Card>
      {needsTrip ? <>
        <SectionLabel style={styles.label}>TRAVEL</SectionLabel>
        <Text style={styles.sub}>Select the Travel only if you located the item in that vehicle journey.</Text>
        {item.candidateTripNos.map((no) => <Pressable key={no} onPress={() => setSelectedTrip(no)}>
          <Card style={[styles.choice, selectedTrip === no && styles.selected]}>
            <Text style={styles.body}>{selectedTrip === no ? '✓ ' : ''}{no}</Text>
          </Card>
        </Pressable>)}
      </> : item.tripNo ? <Text style={styles.trip}>Travel {item.tripNo}</Text> : null}
      {item.response ? <Card style={styles.card}>
        <Text style={styles.body}>{item.response.outcome === 'located' ? 'You recorded that the item was located.' : 'You recorded that the item was not found.'}</Text>
      </Card> : <>
        <PrimaryButton label={busy === 'located' ? 'Recording…' : 'Item Located'} onPress={() => respond('located')} disabled={!!busy} style={{marginTop:24}} />
        <Pressable onPress={() => respond('not-found')} disabled={!!busy} style={styles.notFound}>
          <Text style={styles.notFoundText}>{busy === 'not-found' ? 'Recording…' : 'Item Not Found'}</Text>
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
  trip:{fontSize:13.5,color:colors.muted,marginTop:16},
  choice:{padding:16,marginBottom:8},
  selected:{borderColor:colors.ink},
  notFound:{minHeight:48,alignItems:'center',justifyContent:'center',marginTop:10},
  notFoundText:{fontSize:14,fontWeight:'600',color:colors.ink},
});
