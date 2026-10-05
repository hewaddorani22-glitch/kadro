import { withSupabase } from 'npm:@supabase/server@1.5.1';
import { appleTokenErrorResponse, storeAppleAuthorization } from '../_shared/apple-token-service.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const handler = withSupabase({ auth: 'user' }, async (request: Request, context) => {
  const { data, error } = await context.supabase.auth.getUser();
  if (error || !data.user) return Response.json({ code: 'unauthorized' }, { status: 401, headers });
  let body;
  try {
    // Read at most 8 KiB, including when no Content-Length header is sent.
    const reader = request.body?.getReader();
    if (!reader) throw new Error('invalid_request');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 8192) { await reader.cancel(); throw new Error('invalid_request'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return Response.json({ code: 'invalid_request' }, { status: 400, headers }); }
  try {
    return Response.json(await storeAppleAuthorization(context.supabaseAdmin, data.user, body), { headers });
  } catch (failure) {
    const result = appleTokenErrorResponse(failure);
    return Response.json(result.body, { status: result.status, headers });
  }
});
export default {
  fetch(request: Request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers });
    if (request.method !== 'POST') return Response.json({ code: 'method_not_allowed' }, { status: 405, headers });
    return handler(request);
  },
};
