import {useLocalSearchParams,useRouter} from 'expo-router';
import React,{useEffect,useMemo,useState} from 'react';
import {Pressable,StyleSheet,TextInput,View} from 'react-native';
import {Text} from '../src/components/AppText';
import {Card,LetterheadBar,PrimaryButton,Screen,SectionLabel,Title,useNote} from '../src/components/UI';
import {useGoBack} from '../src/components/nav';
import {acceptFamilyInvite,createFamilyInvite,fetchFamily,fetchGuardianTravels,revokeFamilyLink,type FamilyLink,type GuardianTravel} from '../src/backend/family';
import {useLanguage} from '../src/state/LanguageContext';
import {colors} from '../src/theme';

export default function FamilyScreen(){
 const back=useGoBack(),router=useRouter(),{note,showNote}=useNote(),{t}=useLanguage();
 const params=useLocalSearchParams<{invite?:string;token?:string}>();
 const inviteId=useMemo(()=>typeof params.invite==='string'?params.invite:'',[params.invite]);
 const inviteToken=useMemo(()=>typeof params.token==='string'?params.token:'',[params.token]);
 const [links,setLinks]=useState<FamilyLink[]>([]),[travels,setTravels]=useState<GuardianTravel[]>([]),[busy,setBusy]=useState(false),[accepting,setAccepting]=useState(false),[accepted,setAccepted]=useState(false),[acceptFailed,setAcceptFailed]=useState(false);
 const [teenName,setTeenName]=useState(''),[teenEmail,setTeenEmail]=useState(''),[teenDob,setTeenDob]=useState('');
 const refresh=async()=>{const [l,r]=await Promise.all([fetchFamily().catch(()=>[]),fetchGuardianTravels().catch(()=>[])]);setLinks(l);setTravels(r);};
 useEffect(()=>{refresh();},[]);
 useEffect(()=>{if(!inviteId||!inviteToken||accepted||accepting)return;setAccepting(true);setAcceptFailed(false);acceptFamilyInvite(inviteId,inviteToken).then(async()=>{setAccepted(true);await refresh();}).catch(()=>setAcceptFailed(true)).finally(()=>setAccepting(false));},[inviteId,inviteToken,accepted,accepting]);
 const invite=async()=>{setBusy(true);try{await createFamilyInvite({guardianName:'',teenName,teenEmail,teenDob});setTeenName('');setTeenEmail('');setTeenDob('');await refresh();}catch{showNote(t('traveler.familyInviteUnable'));}finally{setBusy(false);}};
 return <Screen note={note}><LetterheadBar onBack={back}/><Title>{t('traveler.familyTitle')}</Title>
  {(inviteId&&inviteToken)?<Card style={styles.notice}><Text style={styles.name}>{accepting?t('traveler.familyAccepting'):accepted?t('traveler.familyAccepted'):acceptFailed?t('traveler.familyInviteUnable'):t('traveler.familyAccepting')}</Text></Card>:null}
  {travels.length?<><SectionLabel style={{marginTop:20}}>{t('traveler.familyActiveTravel')}</SectionLabel><Card style={styles.card}>{travels.map(r=><Pressable key={r.id} onPress={()=>router.navigate({pathname:'/family-travel',params:{rideId:r.id,tripNo:r.tripNo,travelerName:r.travelerName,operatorName:r.operatorName,operatorId:r.operatorId,travelerUid:r.travelerUid,followUrl:r.followUrl||''}})}><View style={styles.row}><View style={{flex:1}}><Text style={styles.name}>{r.travelerName}</Text><Text style={styles.meta}>{r.dep} → {r.dest} · {r.status}</Text></View><Text style={styles.action}>{t('traveler.familyViewTravel')}</Text></View></Pressable>)}</Card></>:null}
  <SectionLabel style={{marginTop:20}}>{t('traveler.familyAuthorized')}</SectionLabel>
  <Card style={styles.card}>{links.length?links.map(x=><View key={x.id} style={styles.row}><View style={{flex:1}}><Text style={styles.name}>{x.teenName||t('traveler.familyTeenTraveler')}</Text><Text style={styles.meta}>{x.status==='active'&&x.eligible?t('traveler.familyAuthorizedStatus'):t('traveler.familyStatus',{status:x.status})}</Text></View>{x.role==='guardian'&&x.status!=='revoked'?<Pressable onPress={async()=>{await revokeFamilyLink(x.id);await refresh();}}><Text style={styles.action}>{t('traveler.familyRevoke')}</Text></Pressable>:null}</View>):<Text style={styles.meta}>{t('traveler.familyNone')}</Text>}</Card>
  <SectionLabel style={{marginTop:24}}>{t('traveler.familyAddTeen')}</SectionLabel><Card style={styles.card}>
   <TextInput value={teenName} onChangeText={setTeenName} placeholder={t('traveler.familyTeenName')} style={styles.input}/>
   <TextInput value={teenEmail} onChangeText={setTeenEmail} placeholder={t('traveler.familyTeenEmail')} autoCapitalize="none" keyboardType="email-address" style={styles.input}/>
   <TextInput value={teenDob} onChangeText={setTeenDob} placeholder={t('traveler.familyTeenDob')} autoCapitalize="none" style={styles.input}/>
   <Text style={styles.meta}>{t('traveler.familyInviteDelivery')}</Text>
   <PrimaryButton label={busy?t('traveler.familyWorking'):t('traveler.familyCreateInvite')} onPress={invite}/>
  </Card>
 </Screen>;
}
const styles=StyleSheet.create({card:{marginTop:10,padding:18,gap:12},notice:{marginTop:16,padding:18},row:{flexDirection:'row',alignItems:'center',paddingVertical:8},name:{fontSize:15,color:colors.ink},meta:{fontSize:12,color:colors.muted,marginTop:3,lineHeight:18},action:{fontSize:13,color:colors.ink},input:{borderBottomWidth:1,borderBottomColor:colors.hairline,paddingVertical:12,color:colors.ink}});
