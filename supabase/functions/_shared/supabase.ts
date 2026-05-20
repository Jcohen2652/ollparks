// Helper : crée un client Supabase avec service_role (bypass RLS)
// À utiliser uniquement dans les Edge Functions, jamais côté frontend.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Helper : crée un client avec le JWT du caller (respecte RLS)
export function getUserClient(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });
}
