import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useTheme } from '@/context/ThemeContext';
import { assistFoodSearch, captureCapabilities, setCaptureAiConsent, type CaptureCapabilities, type SearchAssistance } from '@/services/mealAnalysis';
import { newAnalysisRequestId } from '@/utils/requestId';

/** Only mounted after a completed, successful, empty ordinary search. The
 * server independently checks eligibility, consent, provider gate and budget. */
export function CaptureSearchHelp({ query, onConfirm }: {query: string; onConfirm: (query: string)=>void}) {
  const {t,locale}=useLanguage(); const {colors}=useTheme();
  const [capability,setCapability]=useState<CaptureCapabilities|null>(null);
  const [details,setDetails]=useState(false),[busy,setBusy]=useState(false);
  const [proposal,setProposal]=useState<SearchAssistance|null>(null),[error,setError]=useState('');
  const generation=useRef(0),request=useRef({query:'',id:''});
  useEffect(()=>{ const current=++generation.current; setCapability(null);setDetails(false);setProposal(null);setError('');setBusy(false);
    void captureCapabilities().then(value=>{if(current===generation.current)setCapability(value);}).catch(()=>{});
    return ()=>{generation.current++;};
  },[query,locale]);
  if(!capability?.searchAssistance)return null;
  const run=async()=>{const current=generation.current;setBusy(true);setError('');
    if(request.current.query!==query)request.current={query,id:newAnalysisRequestId()};
    try{await setCaptureAiConsent(capability.consentVersion,true);
      if(current!==generation.current)return;
      const value=await assistFoodSearch(query,request.current.id);if(current===generation.current)setProposal(value);
    }catch(failure){if(current===generation.current)setError(failure instanceof Error?failure.message:t.errors.analysisFailed);}
    finally{if(current===generation.current)setBusy(false);}
  };
  return <View style={{gap:12,paddingVertical:12}}>
    {!details?<PrimaryButton label={t.errors.aiSearchTitle} variant="secondary" onPress={()=>setDetails(true)}/>:<>
      <Text style={{color:colors.muted,fontSize:14,lineHeight:21}}>{t.errors.aiSearchConsent}</Text>
      {busy?<ActivityIndicator/>:<PrimaryButton label={t.errors.aiSearchAccept} variant="secondary" onPress={()=>void run()}/>}
      {error?<Text accessibilityLiveRegion="polite" style={{color:colors.attention}}>{error}</Text>:null}
      {proposal?.proposal?<><Text style={{color:colors.text,fontSize:16}}>{proposal.proposal.question}</Text><Text style={{color:colors.text}}>{proposal.proposal.canonical}</Text><PrimaryButton label={t.errors.aiSearchApply} onPress={()=>onConfirm(proposal.proposal!.canonical)}/></>:null}
      <PrimaryButton label={t.errors.aiSearchRevoke} variant="secondary" onPress={()=>{void setCaptureAiConsent(capability.consentVersion,false).then(()=>{setDetails(false);setProposal(null);}).catch(failure=>setError(failure.message));}}/>
    </>}
  </View>;
}
