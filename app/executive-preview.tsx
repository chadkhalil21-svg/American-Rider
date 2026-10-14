import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/AppText';
import preview from '../backend/executive-preview-regions.json';

// This page is visual demonstration only. It never sends Travel requests or
// changes any backend authorization, insurance, or screening requirements.
const previewAllowed = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location.hostname === 'american-rider-preview-ng4p.onrender.com';

const southFlorida = [
  {id:'fl-miami-dade',name:'Miami-Dade'},
  {id:'fl-broward',name:'Broward'},
  {id:'fl-palm-beach',name:'Palm Beach'},
];

export default function ExecutivePreview() {
  const allowed=previewAllowed();
  const commands=preview.mode==='preview_only' && preview.version===1 ? preview.commands : [];
  const opened=commands.some(c=>c.scope==='region'&&c.id==='fl-southeast'&&c.action==='open');
  if(!allowed)return <View style={styles.page}><Text>Preview unavailable.</Text></View>;
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.kicker}>AMERICAN RIDER — DEVELOPMENT PREVIEW</Text>
    <Text style={styles.title}>South Florida</Text>
    <Text style={styles.lead}>Three-county preview status</Text>
    {southFlorida.map(c=><View key={c.id} style={styles.county}>
      <Text style={styles.name}>{c.name}</Text>
      <Text style={styles.status}>{opened?'OPEN FOR PREVIEW':'CLOSED FOR PREVIEW'}</Text>
    </View>)}
    <Text style={styles.warning}>TEST DISPLAY ONLY. No paid Travels, live Operator duty, insurance approvals, or background checks are enabled by this preview.</Text>
    <Text style={styles.note}>Production opening and closing use the existing authenticated Founder command and commercial-readiness process.</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({
  page:{flexGrow:1,backgroundColor:'#faf9f6',padding:25,paddingTop:65,gap:18},
  kicker:{fontSize:11,letterSpacing:1.5,color:'#43526d'},
  title:{fontSize:32,fontWeight:'600',color:'#17243b'},
  lead:{fontSize:16,color:'#415166'},
  county:{borderWidth:1,borderColor:'#d9dedf',backgroundColor:'#fff',padding:18,borderRadius:12,gap:8},
  name:{fontSize:19,color:'#17243b',fontWeight:'600'},
  status:{fontSize:12,letterSpacing:1,color:'#1b614a',fontWeight:'700'},
  warning:{fontSize:14,color:'#93571e'},
  note:{fontSize:13,color:'#526070'},
});
