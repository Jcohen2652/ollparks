// POST /functions/v1/gmail-oauth-callback
// Body : { code: string, redirect_uri: string, consent_text?: string }
//
// Échange le code OAuth contre access_token + refresh_token, récupère l'email
// du compte, et upsert dans email_accounts. Le caller doit être authentifié
// (header Authorization: Bearer <user_jwt>).

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClient } from "../_shared/supabase.ts";
import { GmailClient, GmailError, exchangeCodeForTokens } from "../_shared/gmail.ts";

interface Body {
  code: string;
  redirect_uri: string;
  consent_text?: string;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  // Auth : on récupère l'user via son JWT
  const userClient = getUserClient(req);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON invalide" }, 400);
  }
  if (!body.code || !body.redirect_uri) {
    return jsonResponse({ error: "code + redirect_uri requis" }, 400);
  }

  // Échange code contre tokens
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(body.code, body.redirect_uri);
  } catch (e) {
    if (e instanceof GmailError) return jsonResponse({ error: e.message }, 502);
    throw e;
  }

  if (!tokens.refresh_token) {
    return jsonResponse({
      error: "Pas de refresh_token reçu — révoque l'accès dans https://myaccount.google.com/permissions puis recommence",
    }, 400);
  }

  // Récupère l'email du compte connecté
  let email: string;
  try {
    const info = await GmailClient.getUserInfo(tokens.access_token);
    email = info.email;
  } catch (e) {
    return jsonResponse({ error: `userinfo: ${(e as Error).message}` }, 502);
  }

  // Upsert dans email_accounts (service role pour bypass RLS)
  const sb = getServiceClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const scopes = tokens.scope?.split(/\s+/) ?? [];

  const { data: existing } = await sb
    .from("email_accounts")
    .select("id")
    .eq("owner_id", user.id)
    .eq("provider", "gmail")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    await sb.from("email_accounts").update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      scopes,
      revoked_at: null,
    }).eq("id", existing.id);
    return jsonResponse({ id: existing.id, email, action: "refreshed" });
  }

  const { data: created, error } = await sb.from("email_accounts").insert({
    owner_id: user.id,
    provider: "gmail",
    email,
    external_user_id: "me",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
    scopes,
    consent_given_by: user.id,
    consent_text: body.consent_text ?? "Consent given via OLL PARKS web UI",
  }).select("id").single();

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ id: created.id, email, action: "created" });
});
