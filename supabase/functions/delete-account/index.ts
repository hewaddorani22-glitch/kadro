import { withSupabase } from 'npm:@supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const deleteAccount = withSupabase({ auth: 'user' }, async (_request, context) => {
  const { data, error: userError } = await context.supabase.auth.getUser();
  if (userError || !data.user) {
    return Response.json({ code: 'unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const { error } = await context.supabaseAdmin.auth.admin.deleteUser(data.user.id);
  if (error) {
    return Response.json({ code: 'account_deletion_failed' }, { status: 500, headers: corsHeaders });
  }

  return Response.json({ deleted: true }, { status: 200, headers: corsHeaders });
});

export default {
  fetch(request: Request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'DELETE') {
      return Response.json({ code: 'method_not_allowed' }, { status: 405, headers: corsHeaders });
    }
    return deleteAccount(request);
  },
};
