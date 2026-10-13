// Optional, consented market evidence. Never used to change an individual quote.
// No competing-service API access, screenshots, addresses or names are collected.
import { useRouter } from 'expo-router';
import { useLanguage } from '../../src/state/LanguageContext';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { Card, PrimaryButton, Screen, SectionLabel, Title } from '../../src/components/UI';
import { marketResearchCounties, volunteerMarketPrice, type ResearchMarket } from '../../src/backend/voluntaryPrices';
import { prepareResearchAttempt, type PreparedResearchAttempt } from '../../src/backend/voluntaryAttempt';

function Field({title,value,setValue,placeholder}:{
  title:string;value:string;setValue:(value:string)=>void;placeholder?:string;
}){
  return <View style={styles.field}>
    <Text style={styles.label}>{title}</Text>
    <TextInput
      value={value} onChangeText={setValue} placeholder={placeholder}
      keyboardType="decimal-pad" accessibilityLabel={title}
      style={styles.input} autoCapitalize="none" maxLength={32}
    />
  </View>;
}
export default function VolunteerMarketPrice() {
  const router=useRouter();
  const {t}=useLanguage();
  const [markets,setMarkets]=useState<ResearchMarket[]>([]);
  const [marketId,setMarketId]=useState('');
  const [sourceName,setSourceName]=useState('');
  const [price,setPrice]=useState('');
  const [miles,setMiles]=useState('');
  const [minutes,setMinutes]=useState('');
  const [hoursAgo,setHoursAgo]=useState('');
  const [kind,setKind]=useState<'my-receipt'|'my-quote'>('my-receipt');
  const [ordinary,setOrdinary]=useState(false);
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<null|'county'|'market'|'receipt'|'received'|'unavailable'|'auth'>(null);
  const pendingAttempt=useRef<PreparedResearchAttempt|null>(null);
  const sending=useRef(false);
  useEffect(()=>{
    let active=true;
    marketResearchCounties().then(rows=>{if(active)setMarkets(rows);})
      .catch((e)=>{if(active)setMessage(e instanceof Error && e.message==='research_auth_required'?'auth':
        e instanceof Error && e.message==='research_markets_unavailable'?'market':'county');});
    return()=>{active=false;};
  },[]);
  const amount=price.trim(),mi=miles.trim(),mins=minutes.trim(),hours=hoursAgo.trim();
  const currency=/^\d{1,4}(?:\.\d{1,2})?$/.test(amount)?Math.round(Number(amount)*100):NaN;
  const routeMiles=/^\d{1,3}(?:\.\d{1,2})?$/.test(mi)?Number(mi):NaN;
  const routeMins=/^\d{1,3}(?:\.\d{1,2})?$/.test(mins)?Number(mins):NaN;
  const age=/^\d{1,3}$/.test(hours)?Number(hours):NaN;
  const valid=Boolean(marketId&&sourceName.trim().length>=2&&ordinary&&consent&&
    Number.isSafeInteger(currency)&&currency>=300&&currency<=100000&&
    routeMiles>=0.2&&routeMiles<=200&&routeMins>=1&&routeMins<=480&&
    age>=0&&age<=335&&routeMiles/(routeMins/60)<=100);
  async function send(){
    // A ref also rejects double taps before React's disabled state can rerender.
    if(sending.current||!valid)return;
    sending.current=true;
    setBusy(true);setMessage(null);
    const source=sourceName.toLowerCase().trim();
    const providerCode=source.includes('uber')?'other-leading-platform-a':
      source.includes('lyft')?'other-leading-platform-b':'other';
    try{
      const attempt=prepareResearchAttempt({
        marketId,sourceKind:kind,providerCode,
        routedMiles:routeMiles,routedMinutes:routeMins,travelerTotalCents:currency,
        ageHours:age,serviceClass:'standard',ordinaryNoPromotion:true,consentToResearch:true,
      },pendingAttempt.current,Date.now(),
      'own-price-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12));
      pendingAttempt.current=attempt;
      const ok=await volunteerMarketPrice(attempt.body);
      if(!ok){setMessage('receipt');return;}
      pendingAttempt.current=null;
      setMessage('received');
      setPrice('');setMiles('');setMinutes('');setHoursAgo('');
      setSourceName('');setKind('my-receipt');setOrdinary(false);setConsent(false);
    }catch(e){
      setMessage(e instanceof Error&&e.message==='research_auth_required'?'auth':'unavailable');
    }finally{sending.current=false;setBusy(false);}
  }
  const messageKeys={
    county:'operator.fareResearchCountyUnavailable',
    market:'operator.fareResearchMarketUnavailable',
    receipt:'operator.fareResearchReceiptUnconfirmed',
    received:'operator.fareResearchReceived',
    unavailable:'operator.fareResearchUnavailable',
    auth:'operator.fareResearchSignIn',
  } as const;
  return <Screen>
    <Pressable accessibilityRole="button" onPress={()=>router.back()}><Text style={styles.back}>‹ {t('common.back')}</Text></Pressable>
    <Title>{t('operator.fareResearchTitle')}</Title>
    <Text style={styles.intro}>{t('operator.fareResearchIntro')}</Text>
    <SectionLabel>{t('operator.fareResearchCountyPrompt')}</SectionLabel>
    <View style={styles.choices}>
      {markets.map(m=><Pressable key={m.id}
        accessibilityRole="button" accessibilityState={{selected:marketId===m.id}}
        onPress={()=>setMarketId(m.id)} style={[styles.choice,marketId===m.id&&styles.selected]}>
        <Text style={styles.choiceText}>{m.name}, {m.state}</Text>
      </Pressable>)}
    </View>
    <Card style={styles.card}>
      <Text style={styles.label}>{t('operator.fareResearchSource')}</Text>
      <View style={styles.choices}>
        {([['my-receipt',t('operator.fareResearchReceipt')],['my-quote',t('operator.fareResearchQuote')]] as const)
          .map(([key,label])=><Pressable key={key} accessibilityRole="button"
            onPress={()=>setKind(key)} style={[styles.choice,kind===key&&styles.selected]}>
            <Text>{label}</Text>
          </Pressable>)}
      </View>
      <Text style={styles.label}>{t('operator.fareResearchServicePrompt')}</Text>
      <TextInput value={sourceName} onChangeText={setSourceName} maxLength={40}
        autoCapitalize="words" style={styles.input}
        placeholder={t('operator.fareResearchServicePlaceholder')} accessibilityLabel={t('operator.fareResearchServicePrompt')}/>
      <Field title={t('operator.fareResearchTotal')} value={price} setValue={setPrice} placeholder="15.50"/>
      <Field title={t('operator.fareResearchMiles')} value={miles} setValue={setMiles} placeholder="6.3"/>
      <Field title={t('operator.fareResearchMinutes')} value={minutes} setValue={setMinutes} placeholder="19"/>
      <Field title={t('operator.fareResearchHours')}
        value={hoursAgo} setValue={setHoursAgo} placeholder="0–335"/>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked:ordinary}}
        onPress={()=>setOrdinary(x=>!x)} style={styles.check}>
        <Text>{ordinary?'☑':'☐'} {t('operator.fareResearchOrdinary')}</Text>
      </Pressable>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}}
        onPress={()=>setConsent(x=>!x)} style={styles.check}>
        <Text>{consent?'☑':'☐'} {t('operator.fareResearchConsent')}</Text>
      </Pressable>
      <Text style={styles.note}>{t('operator.fareResearchNote')}</Text>
      <PrimaryButton label={busy?t('operator.fareResearchSubmitting'):t('operator.fareResearchShare')} onPress={send}
        disabled={!valid||busy} style={{marginTop:14}}/>
      {message? <Text accessibilityRole="alert" style={styles.message}>{t(messageKeys[message])}</Text>:null}
    </Card>
  </Screen>;
}
const styles=StyleSheet.create({
  back:{fontSize:15,marginBottom:14},
  intro:{fontSize:14,lineHeight:21,marginVertical:18},
  card:{marginTop:15,paddingVertical:18},
  label:{fontSize:14,fontWeight:'600',marginBottom:8},
  field:{marginTop:14},
  input:{borderWidth:1,borderColor:'#9FA8B6',borderRadius:10,
    paddingHorizontal:14,paddingVertical:12,fontSize:16,minHeight:46},
  choices:{gap:8,marginTop:9},
  choice:{borderWidth:1,borderColor:'#B3BBC8',borderRadius:12,padding:12},
  selected:{borderColor:'#2E5FE0',borderWidth:2},
  choiceText:{fontSize:14},
  check:{marginTop:17,paddingVertical:7},
  note:{fontSize:12,lineHeight:19,opacity:0.8,marginTop:14},
  message:{marginTop:12,fontSize:14},
});
