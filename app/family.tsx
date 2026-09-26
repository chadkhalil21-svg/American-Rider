import React,{useEffect,useState} from 'react';
import {Pressable,StyleSheet,TextInput,View} from 'react-native';
import {Text} from '../src/components/AppText';
import {Card,LetterheadBar,PrimaryButton,Screen,SectionLabel,Title,useNote} from '../src/components/UI';
import {useGoBack} from '../src/components/nav';
import {acceptFamilyInvite,createFamilyInvite,fetchFamily,revokeFamilyLink,type FamilyLink} from '../src/backend/family';
import {colors} from '../src/theme';

export default function FamilyScreen(){
 const back=useGoBack(),{note}=useNote();const [links,setLinks]=useState<FamilyLink[]>([]),[busy,setBusy]=useState(false);
 const [teenName,setTeenName]=useState(''),[teenEmail,setTeenEmail]=useState(''),[teenDob,setTeenDob]=useState('');
 const [inviteId,setInviteId]=useState(''),[inviteToken,setInviteToken]=useState('');
 const refresh=async()=>setLinks(await fetchFamily().catch(()=>[]));useEffect(()=>{refresh();},[]);
 const invite=async()=>{setBusy(true);try{const x=await createFamilyInvite({guardianName:'',teenName,teenEmail,teenDob});setInviteId(x.id||'');setInviteToken(x.inviteToken||'');await refresh();}finally{setBusy(false);}};
 const accept=async()=>{setBusy(true);try{await acceptFamilyInvite(inviteId,inviteToken);await refresh();}finally{setBusy(false);}};
 return <Screen note={note}><LetterheadBar onBack={back}/><Title>Family</Title>
  <SectionLabel style={{marginTop:20}}>AUTHORIZED TEEN TRAVELERS</SectionLabel>
  <Card style={styles.card}>{links.length?links.map(x=><View key={x.id} style={styles.row}><View style={{flex:1}}><Text style={styles.name}>{x.teenName||'Teen Traveler'}</Text><Text style={styles.meta}>{x.status==='active'&&x.eligible?'Authorized for Teen Travel':x.status}</Text></View>{x.role==='guardian'&&x.status!=='revoked'?<Pressable onPress={async()=>{await revokeFamilyLink(x.id);await refresh();}}><Text style={styles.action}>Revoke</Text></Pressable>:null}</View>):<Text style={styles.meta}>No Family authorizations.</Text>}</Card>
  <SectionLabel style={{marginTop:24}}>ADD A TEEN TRAVELER</SectionLabel><Card style={styles.card}>
   <TextInput value={teenName} onChangeText={setTeenName} placeholder="Teen name" style={styles.input}/>
   <TextInput value={teenEmail} onChangeText={setTeenEmail} placeholder="Teen account email" autoCapitalize="none" keyboardType="email-address" style={styles.input}/>
   <TextInput value={teenDob} onChangeText={setTeenDob} placeholder="Date of birth — YYYY-MM-DD" autoCapitalize="none" style={styles.input}/>
   <PrimaryButton label={busy?'Working…':'Create Family Invitation'} onPress={invite}/>
  </Card>
  <SectionLabel style={{marginTop:24}}>ACCEPT AN INVITATION</SectionLabel><Card style={styles.card}>
   <TextInput value={inviteId} onChangeText={setInviteId} placeholder="Invitation ID" autoCapitalize="none" style={styles.input}/>
   <TextInput value={inviteToken} onChangeText={setInviteToken} placeholder="Invitation code" autoCapitalize="none" style={styles.input}/>
   <PrimaryButton label={busy?'Working…':'Accept Family Invitation'} onPress={accept}/>
  </Card>
 </Screen>;
}
const styles=StyleSheet.create({card:{marginTop:10,padding:18,gap:12},row:{flexDirection:'row',alignItems:'center',paddingVertical:8},name:{fontSize:15,color:colors.ink},meta:{fontSize:12,color:colors.muted,marginTop:3},action:{fontSize:13,color:colors.ink},input:{borderBottomWidth:1,borderBottomColor:colors.hairline,paddingVertical:12,color:colors.ink}});
