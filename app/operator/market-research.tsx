// Optional, consented market evidence. Never used to change an individual quote.
// No competing-service API access, screenshots, addresses or names are collected.
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { Card, PrimaryButton, Screen, SectionLabel, Title } from '../../src/components/UI';
import { marketResearchCounties, volunteerMarketPrice, type ResearchMarket } from '../../src/backend/voluntaryPrices';

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
  const [message,setMessage]=useState('');
  const observationId=useRef('own-price-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12));
  useEffect(()=>{
    let active=true;
    marketResearchCounties().then(rows=>{if(active)setMarkets(rows);})
      .catch(()=>{if(active)setMessage('County list unavailable. Please try again.');});
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
    if(busy||!valid)return;
    setBusy(true);setMessage('');
    const source=sourceName.toLowerCase().trim();
    const providerCode=source.includes('uber')?'other-leading-platform-a':
      source.includes('lyft')?'other-leading-platform-b':'other';
    try{
      const ok=await volunteerMarketPrice({
        observationId:observationId.current,
        marketId,sourceKind:kind,providerCode,
        observedAt:new Date(Date.now()-age*3600000).toISOString(),
        routedMiles:routeMiles,routedMinutes:routeMins,travelerTotalCents:currency,
        serviceClass:'standard',ordinaryNoPromotion:true,consentToResearch:true,
      });
      if(!ok)throw Error('Research receipt not confirmed.');
      setMessage('Research received. Thank you. This does not change Traveler prices.');
      observationId.current='own-price-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
      setPrice('');setMiles('');setMinutes('');setHoursAgo('');
    }catch(e){setMessage(e instanceof Error?e.message:'Research intake unavailable.');}
    finally{setBusy(false);}
  }
  return <Screen>
    <Pressable accessibilityRole="button" onPress={()=>router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Title>Help keep fares fair</Title>
    <Text style={styles.intro}>You may share a genuine, ordinary standard Travel price you saw or paid.
      This optional research helps American Rider assess local prices. No screenshots or passenger details are required.</Text>
    <SectionLabel>Where did the journey begin?</SectionLabel>
    <View style={styles.choices}>
      {markets.map(m=><Pressable key={m.id}
        accessibilityRole="button" accessibilityState={{selected:marketId===m.id}}
        onPress={()=>setMarketId(m.id)} style={[styles.choice,marketId===m.id&&styles.selected]}>
        <Text style={styles.choiceText}>{m.name}, {m.state}</Text>
      </Pressable>)}
    </View>
    <Card style={styles.card}>
      <Text style={styles.label}>Your source</Text>
      <View style={styles.choices}>
        {([['my-receipt','Completed Travel receipt'],['my-quote','Upfront Travel quote']] as const)
          .map(([key,label])=><Pressable key={key} accessibilityRole="button"
            onPress={()=>setKind(key)} style={[styles.choice,kind===key&&styles.selected]}>
            <Text>{label}</Text>
          </Pressable>)}
      </View>
      <Text style={styles.label}>Travel service shown on the receipt or quote</Text>
      <TextInput value={sourceName} onChangeText={setSourceName} maxLength={40}
        autoCapitalize="words" style={styles.input}
        placeholder="Service name" accessibilityLabel="Travel service name"/>
      <Field title="Total price paid or quoted (USD)" value={price} setValue={setPrice} placeholder="e.g. 15.50"/>
      <Field title="Journey distance (miles)" value={miles} setValue={setMiles} placeholder="e.g. 6.3"/>
      <Field title="Journey duration (minutes)" value={minutes} setValue={setMinutes} placeholder="e.g. 19"/>
      <Field title="Hours since this price was observed (0 means just now)"
        value={hoursAgo} setValue={setHoursAgo} placeholder="0–335"/>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked:ordinary}}
        onPress={()=>setOrdinary(x=>!x)} style={styles.check}>
        <Text>{ordinary?'☑':'☐'} This was an ordinary standard Travel, with no promotional discount or unusual event pricing.</Text>
      </Pressable>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}}
        onPress={()=>setConsent(x=>!x)} style={styles.check}>
        <Text>{consent?'☑':'☐'} I choose to share these price facts for American Rider's internal research. I have the right to share them.</Text>
      </Pressable>
      <Text style={styles.note}>We retain county-level and price details for review, not precise pickup coordinates. Reports are not independently verified and do not set live fares.</Text>
      <PrimaryButton label={busy?'Submitting…':'Share price information'} onPress={send}
        disabled={!valid||busy} style={{marginTop:14}}/>
      {message? <Text accessibilityRole="alert" style={styles.message}>{message}</Text>:null}
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
