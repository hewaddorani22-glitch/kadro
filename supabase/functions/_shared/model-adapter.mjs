import { detectionSchema, validateDetection } from './detection.mjs';

export const GEMINI_MODEL = 'google/gemini-3.8-flash';
export const GEMINI_ROUTE = 'google-vertex/global';
export const GEMINI_CONSENT_VERSION = '2026-10-01-gemini-candidate-v1';
// Deliberately false until route terms, account ZDR and the A/B/C comparison
// are evidenced. Neither a model env var nor a client build enables this path.
export const GEMINI_RELEASE_APPROVED = false;

export class ModelError extends Error {
  constructor(code, status = 502, retryAfter = undefined) {
    super(code); this.code=code; this.status=status; this.retryAfter=retryAfter;
  }
}

export function modelRequest({content, model='openai/gpt-4.1-mini', provider='openrouter', reasoning='low', schema=detectionSchema, name='kandro_meal_detection'}) {
  const gemini=model===GEMINI_MODEL;
  if (!['openrouter','openai'].includes(provider) || (gemini && provider!=='openrouter')) throw new ModelError('ai_provider_invalid',503);
  if (gemini && !['low','medium'].includes(reasoning)) throw new ModelError('ai_provider_invalid',503);
  if (!gemini && !['openai/gpt-4.1-mini','gpt-4.1-mini'].includes(model)) throw new ModelError('ai_provider_invalid',503);
  const policy={data_collection:'deny',only:[gemini?GEMINI_ROUTE:'azure'],allow_fallbacks:false,zdr:true,...(gemini?{require_parameters:true}:{})};
  if (gemini) return {
    url:'https://openrouter.ai/api/v1/chat/completions',
    body:{model,store:false,max_tokens:8192,reasoning:{effort:reasoning,exclude:true},provider:policy,
      messages:[{role:'user',content:content.map(part=>part.type==='input_image'
        ? {type:'image_url',image_url:{url:part.image_url}} : {type:'text',text:part.text})}],
      response_format:{type:'json_schema',json_schema:{name,strict:true,schema}}},
  };
  return {url:provider==='openrouter'?'https://openrouter.ai/api/v1/responses':'https://api.openai.com/v1/responses',
    body:{model,store:false,max_output_tokens:2000,...(provider==='openrouter'?{provider:policy}:{}),
      input:[{role:'user',content}],text:{format:{type:'json_schema',name,strict:true,schema}}}};
}

export function parseStructuredResponse(payload, gemini=false) {
  let text;
  if (!payload || typeof payload!=='object' || payload.error) throw new ModelError('provider_response_invalid');
  if (gemini) {
    const choice=payload.choices?.[0];
    if (choice?.message?.refusal || choice?.finish_reason==='content_filter') throw new ModelError('model_refused',422);
    if (choice?.finish_reason==='length') throw new ModelError('model_truncated');
    if (choice?.finish_reason!=='stop' || payload.choices.length!==1) throw new ModelError('provider_response_invalid');
    text=choice.message?.content;
  } else {
    if (payload.status==='incomplete' || payload.incomplete_details) throw new ModelError('model_truncated');
    if (payload.status && payload.status!=='completed') throw new ModelError('provider_response_invalid');
    const parts=(Array.isArray(payload.output)?payload.output:[]).flatMap(row=>Array.isArray(row.content)?row.content:[]);
    if (parts.some(part=>part.type==='refusal')) throw new ModelError('model_refused',422);
    text=payload.output_text ?? parts.filter(part=>part.type==='output_text').map(part=>part.text).join('');
  }
  if (typeof text!=='string' || !text.trim() || text.length>100_000) throw new ModelError('provider_response_invalid');
  try { return JSON.parse(text); } catch { throw new ModelError('provider_response_invalid'); }
}

/** One request, bounded through body consumption; no automatic provider retry. */
export async function requestStructured({apiKey, fetchImpl=fetch, signal, timeoutMs=45_000, validate=validateDetection, routeAuthorized=false, ...options}) {
  if (!apiKey) throw new ModelError('ai_key_missing',503);
  if (options.model===GEMINI_MODEL && !routeAuthorized) throw new ModelError('ai_route_not_approved',503);
  const request=modelRequest(options);
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  if (signal?.aborted) controller.abort();
  let timer;
  try {
    return await Promise.race([
      (async()=>{
        const response=await fetchImpl(request.url,{method:'POST',signal:controller.signal,
          headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','X-Title':'Kandro'},body:JSON.stringify(request.body)});
        if (!response.ok) throw new ModelError(response.status===429?'provider_rate_limited':'provider_error',response.status===429?429:502,response.headers?.get('retry-after'));
        let payload; try { payload=await response.json(); } catch { throw new ModelError('provider_response_invalid'); }
        try { return validate(parseStructuredResponse(payload,options.model===GEMINI_MODEL)); }
        catch (error) { if (error instanceof ModelError) throw error; throw new ModelError('provider_response_invalid'); }
      })(),
      new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ModelError('provider_timeout',504));},timeoutMs);}),
    ]);
  } catch(error) {
    if(error instanceof ModelError)throw error;
    if(controller.signal.aborted)throw new ModelError('provider_timeout',504);
    throw new ModelError('provider_error');
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
