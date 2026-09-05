import { withSupabase } from 'npm:@supabase/server@1.5.1';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v2';
const REVENUECAT_TIMEOUT_MS = 8_000;

type RevenueCatCustomer = {
  id?: unknown;
};

type RevenueCatCustomerList = {
  items?: RevenueCatCustomer[];
};

async function revenueCatRequest(path: string, init?: RequestInit) {
  const apiKey = Deno.env.get('REVENUECAT_ERASURE_API_KEY')?.trim();
  if (!apiKey) throw new Error('revenuecat_erasure_not_configured');

  return fetch(`${REVENUECAT_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(REVENUECAT_TIMEOUT_MS),
  });
}

async function eraseRevenueCatCustomer(appUserId: string) {
  const projectId = Deno.env.get('REVENUECAT_PROJECT_ID')?.trim();
  if (!projectId) throw new Error('revenuecat_project_not_configured');

  // RevenueCat's v2 search matches Custom App User IDs. Kandro uses the
  // random Supabase UUID as that ID, so the result does not depend on email.
  const projectPath = `/projects/${encodeURIComponent(projectId)}`;
  const search = await revenueCatRequest(
    `${projectPath}/customers?search=${encodeURIComponent(appUserId)}&limit=100`,
  );
  if (!search.ok) throw new Error(`revenuecat_search_${search.status}`);

  const payload = await search.json() as RevenueCatCustomerList;
  const customerIds = Array.isArray(payload.items)
    ? payload.items
      .map((customer) => typeof customer.id === 'string' ? customer.id : '')
      .filter(Boolean)
    : [];

  for (const customerId of new Set(customerIds)) {
    const deletion = await revenueCatRequest(
      `${projectPath}/customers/${encodeURIComponent(customerId)}`,
      { method: 'DELETE' },
    );
    // 200 means complete, 202 means durably queued, and 404 means another
    // retry already removed the customer. Every other response keeps the
    // Kandro account intact so the user can retry without losing the join ID.
    if (![200, 202, 404].includes(deletion.status)) {
      throw new Error(`revenuecat_deletion_${deletion.status}`);
    }
  }
}

const deleteAccount = withSupabase({ auth: 'user' }, async (_request, context) => {
  const { data, error: userError } = await context.supabase.auth.getUser();
  if (userError || !data.user) {
    return Response.json({ code: 'unauthorized' }, { status: 401, headers: corsHeaders });
  }

  try {
    await eraseRevenueCatCustomer(data.user.id);
  } catch {
    return Response.json(
      { code: 'account_deletion_temporarily_unavailable' },
      { status: 503, headers: corsHeaders },
    );
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
