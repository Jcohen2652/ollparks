// POST /functions/v1/gmail-sync
// Body : { account_id: string, days?: number, max_messages?: number }
//
// Ingestion Gmail incrémentale d'un email_account :
// - Refresh access_token si expiré
// - Liste les messages des N derniers jours via query Gmail
// - Pour chaque message : dedupe sur gmail_msg_id, upsert contact+entreprise,
//   insère interaction, extrait besoin si typologie/zones/surface détectées
// - Retourne stats { fetched, new_messages, new_contacts, new_entreprises, new_besoins, skipped }

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClient } from "../_shared/supabase.ts";
import {
  GmailClient,
  GmailError,
  extractBodyText,
  getHeader,
  parseFromHeader,
  refreshAccessToken,
} from "../_shared/gmail.ts";
import {
  extractBusinessSignals,
  extractCompanyFromEmail,
  extractPropertyNeed,
  parseSignature,
} from "../_shared/extract.ts";

interface Body {
  account_id: string;
  days?: number;
  max_messages?: number;
}

interface SyncStats {
  account_id: string;
  fetched: number;
  new_messages: number;
  new_contacts: number;
  new_entreprises: number;
  new_besoins: number;
  skipped: number;
  errors: number;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  // Auth user
  const userClient = getUserClient(req);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return jsonResponse({ error: "JSON invalide" }, 400); }
  if (!body.account_id) return jsonResponse({ error: "account_id requis" }, 400);

  const days = body.days ?? 30;
  const maxMessages = body.max_messages ?? 200;

  const sb = getServiceClient();

  // Charge le compte
  const { data: account, error: accErr } = await sb
    .from("email_accounts")
    .select("*")
    .eq("id", body.account_id)
    .eq("owner_id", user.id)  // sécurité : user ne peut sync que ses propres comptes
    .maybeSingle();
  if (accErr || !account) return jsonResponse({ error: "Compte introuvable ou non autorisé" }, 404);
  if (account.revoked_at) return jsonResponse({ error: "Compte révoqué" }, 400);

  // Refresh token si expiré (ou si on est dans la dernière minute)
  let accessToken: string = account.access_token;
  if (new Date(account.token_expires_at).getTime() - 60_000 < Date.now()) {
    try {
      const refreshed = await refreshAccessToken(account.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await sb.from("email_accounts").update({
        access_token: accessToken,
        token_expires_at: newExpiresAt,
      }).eq("id", account.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from("email_accounts").update({
        sync_status: "error", sync_error: `refresh: ${msg}`,
      }).eq("id", account.id);
      return jsonResponse({ error: `Refresh token failed: ${msg}` }, 502);
    }
  }

  // Mark sync as running
  await sb.from("email_accounts").update({
    sync_status: "running", sync_error: null,
  }).eq("id", account.id);

  const stats: SyncStats = {
    account_id: account.id,
    fetched: 0, new_messages: 0, new_contacts: 0,
    new_entreprises: 0, new_besoins: 0, skipped: 0, errors: 0,
  };

  // Gmail query : derniers N jours, pas dans la corbeille/spam
  const query = `newer_than:${days}d -in:trash -in:spam`;
  const gmail = new GmailClient(accessToken);

  try {
    for await (const meta of gmail.listMessages(query, maxMessages)) {
      stats.fetched++;
      try {
        await processMessage(sb, gmail, meta.id, account, stats);
      } catch (e) {
        stats.errors++;
        console.error(`message ${meta.id}:`, e);
      }
    }
  } catch (e) {
    if (e instanceof GmailError) {
      await sb.from("email_accounts").update({
        sync_status: "error", sync_error: e.message,
      }).eq("id", account.id);
      return jsonResponse({ error: e.message, partial_stats: stats }, 502);
    }
    throw e;
  }

  // Mark sync as idle + save stats
  await sb.from("email_accounts").update({
    sync_status: "idle",
    last_sync_at: new Date().toISOString(),
    last_sync_stats: stats,
  }).eq("id", account.id);

  return jsonResponse(stats);
});

// ---------------------------------------------------------------------------
// Process a single Gmail message
// ---------------------------------------------------------------------------

async function processMessage(sb: any, gmail: GmailClient, msgId: string, account: any, stats: SyncStats) {
  // 1. Idempotence : check gmail_msg_id déjà ingéré
  const { data: existing } = await sb
    .from("interactions")
    .select("id")
    .eq("gmail_msg_id", msgId)
    .eq("email_account_id", account.id)
    .maybeSingle();
  if (existing) { stats.skipped++; return; }

  // 2. Charge le message complet
  const full = await gmail.getMessageFull(msgId);
  const body = extractBodyText(full);
  const subject = getHeader(full, "Subject") ?? "";
  const fromHeader = getHeader(full, "From");
  const { name: fromName, email: fromEmail } = parseFromHeader(fromHeader);
  const dateHeader = getHeader(full, "Date");
  const occurredAt = dateHeader ? new Date(dateHeader).toISOString() : new Date(Number(full.internalDate)).toISOString();

  // 3. Direction : "out" si From contient l'email du compte connecté, sinon "in"
  const direction = fromEmail?.toLowerCase() === account.email.toLowerCase() ? "out" : "in";

  // 4. Contact + entreprise
  let contactId: string | null = null;
  let entrepriseId: string | null = null;
  // On track le contact "remote" (celui qui n'est pas le compte connecté)
  const remoteEmail = direction === "out"
    ? parseFromHeader(getHeader(full, "To"))?.email
    : fromEmail;
  const remoteName = direction === "out"
    ? parseFromHeader(getHeader(full, "To"))?.name
    : fromName;

  if (remoteEmail) {
    const contact = await upsertContact(sb, remoteEmail, remoteName, body);
    if (contact.created) stats.new_contacts++;
    contactId = contact.id;

    if (!contact.entreprise_id) {
      const ent = await upsertEntrepriseFromEmail(sb, remoteEmail);
      if (ent?.created) stats.new_entreprises++;
      if (ent) {
        entrepriseId = ent.id;
        await sb.from("contacts").update({ entreprise_id: ent.id }).eq("id", contact.id);
      }
    } else {
      entrepriseId = contact.entreprise_id;
    }
  }

  // 5. Insert interaction
  const signals = extractBusinessSignals(`${subject}\n${body}`);
  const { data: interaction, error: e1 } = await sb.from("interactions").insert({
    type: "email", direction,
    contact_id: contactId, entreprise_id: entrepriseId,
    sujet: subject.slice(0, 500),
    contenu: body.slice(0, 10_000),
    gmail_msg_id: msgId,
    gmail_thread_id: full.threadId,
    email_account_id: account.id,
    metadata: signals.length ? { signals } : null,
    occurred_at: occurredAt,
  }).select("id").single();
  if (e1) throw new Error(`interactions insert: ${e1.message}`);
  stats.new_messages++;

  // 6. Extraction besoin immo (si direction == "in" : c'est un client qui demande)
  if (direction === "in") {
    const need = extractPropertyNeed(`${subject}\n${body}`);
    const confidence = computeConfidence(need, body);
    if (confidence >= 60) {
      await sb.from("besoins").insert({
        entreprise_id: entrepriseId,
        contact_id: contactId,
        typologie: need.typologie,
        surface_min: need.surface_min,
        surface_max: need.surface_max,
        budget_max: need.budget_max,
        zones: need.zones.length ? need.zones : null,
        timing: need.timing,
        statut: "actif",
        source_interaction_id: interaction.id,
        confidence_score: confidence,
      });
      stats.new_besoins++;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertContact(sb: any, email: string, name: string | undefined, body: string) {
  const { data: existing } = await sb
    .from("contacts").select("id, entreprise_id").eq("email", email).maybeSingle();
  if (existing) return { id: existing.id, entreprise_id: existing.entreprise_id, created: false };

  const sig = parseSignature(body);
  let prenom: string | null = null;
  let nom: string | null = null;
  if (name && name.includes(" ")) {
    const parts = name.split(" ");
    prenom = parts[0];
    nom = parts.slice(1).join(" ");
  } else if (sig.nom_prenom?.includes(" ")) {
    const parts = sig.nom_prenom.split(" ");
    prenom = parts[0];
    nom = parts.slice(1).join(" ");
  } else if (name) {
    nom = name;
  }
  const { data: created, error } = await sb
    .from("contacts")
    .insert({
      prenom, nom, email,
      telephone: sig.telephone ?? null,
      poste: sig.poste ?? null,
      source: "gmail",
    })
    .select("id, entreprise_id")
    .single();
  if (error) throw new Error(`upsertContact: ${error.message}`);
  return { id: created.id, entreprise_id: created.entreprise_id, created: true };
}

async function upsertEntrepriseFromEmail(sb: any, email: string) {
  const root = extractCompanyFromEmail(email);
  if (!root) return null;
  const rs = root.replace(/-/g, " ")
    .split(" ").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  const { data: existing } = await sb
    .from("entreprises").select("id").eq("raison_sociale", rs).maybeSingle();
  if (existing) return { id: existing.id, created: false };
  const { data: created, error } = await sb
    .from("entreprises").insert({ raison_sociale: rs }).select("id").single();
  if (error) throw new Error(`upsertEntreprise: ${error.message}`);
  return { id: created.id, created: true };
}

/**
 * Score de confiance "is_demande_immo" — 0 à 100.
 * Heuristiques cumulatives.
 */
function computeConfidence(need: any, body: string): number {
  let score = 0;
  if (need.typologie) score += 35;
  if (need.surface_min || need.surface_max) score += 25;
  if (need.zones.length > 0) score += 20;
  if (need.budget_max) score += 10;
  if (need.timing) score += 10;
  // Boost : keywords explicites
  const low = body.toLowerCase();
  const strongKeywords = [
    "recherchons", "nous cherchons", "à la recherche de",
    "bureaux", "locaux", "déménager", "déménagement",
    "mètres carrés", "m²", "loyer", "achat", "location",
    "rdv", "visite", "rendez-vous",
  ];
  const matches = strongKeywords.filter((k) => low.includes(k)).length;
  if (matches >= 3) score += 10;
  return Math.min(100, score);
}
