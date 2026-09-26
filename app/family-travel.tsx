import {useLocalSearchParams} from 'expo-router';
import React,{useEffect,useState} from 'react';
import {Linking,Pressable,StyleSheet,TextInput,View} from 'react-native';
import {Text} from '../src/components/AppText';
import {Card,LetterheadBar,PrimaryButton,Screen,SectionLabel,Title,useNote} from '../src/components/UI';
import {useGoBack} from '../src/components/nav';
import {sendTravelMessage,watchTravelThread,type TravelMessage} from '../src/backend/messages';
import {useLanguage} from '../src/state/LanguageContext';
import {colors} from '../src/theme';

export default function FamilyTravel(){
 const back=useGoBack(),{note,showNote}=useNote(),{t}=useLanguage();
 const p=useLocalSearchParams<{rideId:string;tripNo:string;travelerName:string;operatorName:string;operatorId:string;travelerUid:string;followUrl?:string}>();
 const rideId=String(p.rideId||''),tripNo=String(p.tripNo||'');
 const [messages,setMessages]=useState<TravelMessage[]>([]),[text,setText]=useState(''),[sending,setSending]=useState(false);
 useEffect(()=>watchTravelThread(tripNo,'guardian',setMessages,()=>showNote(t('traveler.errConversationLoad'))),[tripNo,showNote,t]);
 const send=async()=>{if(!text.trim()||sending)return;setSending(true);const value=text.trim();const ok=await sendTravelMessage({rideId,tripNo,text:value,from:'guardian'});if(ok)setText('');else showNote(t('traveler.familyMessageFailed'));setSending(false);};
 return <Screen note={note}><LetterheadBar onBack={back}/><Title>{t('traveler.familyTeenTravel')}</Title>
  <Card style={styles.card}><Text style={styles.name}>{String(p.travelerName||t('traveler.familyTeenTraveler'))}</Text><Text style={styles.meta}>{tripNo}</Text><Text style={styles.meta}>{t('traveler.familyOperator',{name:String(p.operatorName||'—')})}</Text>
   {p.followUrl?<Pressable onPress={()=>Linking.openURL(String(p.followUrl))}><Text style={styles.link}>{t('traveler.familyFollowLive')}</Text></Pressable>:null}
  </Card>
  <SectionLabel style={{marginTop:24}}>{t('traveler.familyConversation')}</SectionLabel>
  <Card style={styles.card}>{messages.length?messages.map(m=><View key={m.id} style={styles.message}><Text style={styles.messageWho}>{m.from==='guardian'?t('traveler.familyYou'):m.from==='operator'?t('traveler.operator'):t('traveler.familyTeenTraveler')}</Text><Text style={styles.messageText}>{m.text}</Text></View>):<Text style={styles.meta}>{t('traveler.familyNoMessages')}</Text>}
   <TextInput value={text} onChangeText={setText} placeholder={t('traveler.familyMessagePlaceholder')} multiline style={styles.input}/>
   <PrimaryButton label={sending?t('traveler.familyWorking'):t('traveler.familySendMessage')} onPress={send}/>
  </Card>
 </Screen>;
}
const styles=StyleSheet.create({card:{marginTop:10,padding:18,gap:12},name:{fontSize:16,color:colors.ink,fontWeight:'600'},meta:{fontSize:12.5,color:colors.muted,lineHeight:18},link:{fontSize:14,color:colors.blue,marginTop:4},message:{borderTopWidth:1,borderTopColor:colors.hairline,paddingTop:10},messageWho:{fontSize:11,color:colors.muted,textTransform:'uppercase'},messageText:{fontSize:14,color:colors.ink,marginTop:4,lineHeight:20},input:{borderBottomWidth:1,borderBottomColor:colors.hairline,paddingVertical:12,color:colors.ink,minHeight:52}});
