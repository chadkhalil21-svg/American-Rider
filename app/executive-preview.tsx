import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/AppText';
import { useLanguage } from '../src/state/LanguageContext';
import preview from '../backend/executive-preview-regions.json';

// This page is visual demonstration only. It never sends Travel requests or
// changes any backend authorization, insurance, or screening requirements.
const previewAllowed = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location.hostname === 'american-rider-preview-ng4p.onrender.com';

type PreviewCounty={id:string;name:string};
type PreviewRegion={id:string;name:string;counties:PreviewCounty[]};
type PreviewCommand={scope:string;id:string;action:string};
type PreviewConfig={version:number;mode:string;regions:PreviewRegion[];commands:PreviewCommand[]};
const configured=preview as PreviewConfig;
const regionNames=(Array.isArray(configured.regions)?configured.regions:[]);
function projectedCounties(region:PreviewRegion){
  const counties=Array.isArray(region.counties)?region.counties:[];
  const status:Record<string,boolean>={};
  for(const c of counties)status[c.id]=false;
  if(configured.version!==1||configured.mode!=='preview_only')return counties.map(c=>({...c,opened:false}));
  for(const command of Array.isArray(configured.commands)?configured.commands:[]) {
    if(!['open','close'].includes(command.action))continue;
    if(command.scope==='region' && command.id===region.id) {
      for(const c of counties)status[c.id]=command.action==='open';
    }
    if(command.scope==='county' && Object.prototype.hasOwnProperty.call(status,command.id))
      status[command.id]=command.action==='open';
  }
  return counties.map(c=>({...c,opened:status[c.id]===true}));
}

export default function ExecutivePreview() {
  const { t } = useLanguage();
  const allowed=previewAllowed();
  if(!allowed)return <View style={styles.page}><Text>{t('traveler.executivePreviewUnavailable')}</Text></View>;
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.kicker}>{t('traveler.executivePreviewLabel')}</Text>
    <Text style={styles.title}>{t('traveler.executivePreviewTitle')}</Text>
    <Text style={styles.lead}>{t('traveler.executivePreviewSubtitle')}</Text>
    {regionNames.map(region=><View key={region.id} style={styles.region}>
      <Text style={styles.name}>{region.name}</Text>
      {projectedCounties(region).map(county=><View key={county.id} style={styles.county}>
        <Text style={styles.name}>{county.name}</Text>
        <Text style={styles.status}>{county.opened?t('traveler.executivePreviewOpen'):t('traveler.executivePreviewClosed')}</Text>
      </View>)}
    </View>)}
    <Text style={styles.warning}>{t('traveler.executivePreviewWarning')}</Text>
    <Text style={styles.note}>{t('traveler.executivePreviewNote')}</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({
  page:{flexGrow:1,backgroundColor:'#faf9f6',padding:25,paddingTop:65,gap:18},
  kicker:{fontSize:11,letterSpacing:1.5,color:'#43526d'},
  title:{fontSize:32,fontWeight:'600',color:'#17243b'},
  lead:{fontSize:16,color:'#415166'},
  region:{gap:10},
  county:{borderWidth:1,borderColor:'#d9dedf',backgroundColor:'#fff',padding:18,borderRadius:12,gap:8},
  name:{fontSize:19,color:'#17243b',fontWeight:'600'},
  status:{fontSize:12,letterSpacing:1,color:'#1b614a',fontWeight:'700'},
  warning:{fontSize:14,color:'#93571e'},
  note:{fontSize:13,color:'#526070'},
});
