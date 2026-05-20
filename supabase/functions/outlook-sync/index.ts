// POST /functions/v1/outlook-sync
// Body : { user_id: string, since_iso?: string, max_messages?: number }
//
// Ingestion incrémentale d'un mailbox Microsoft 365 :
// - dedupe sur outlook_msg_id
// - upsert contact (par email) + entreprise (par domaine)
// - insère interaction
// - extrait un besoin si typologie/surface/zones détectées

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { GraphClient, GraphError } from "../_shared/graph.ts";
import {
  extractBusinessSignals,
  extractCompanyFromEmail,
  extractPropertyNeed,
  parseSignature,
} from "../_shared/extract.ts";

interface SyncBody {
  user_id: string;
  since_iso?: string;
  max_messages?: number;
}

interface SyncStats {
  fetched: number;
  new_messages: number;
  new_contacts: number;
  new_entreprises: number;
  new_besoins: number;
  skipped: number;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  let body: SyncBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON invalide" }, 400);
  }
  if (!body.user_id) return jsonResponse({ error: "user_id requis" }, 400);

  const stats: SyncStats = {
    fetched: 0, new_messages: 0, new_contacts: 0,
    new_entreprises: 0, new_besoins: 0, skipped: 0,
  };

  let graph: GraphClient;
  try {
    graph = GraphClient.fromEnv();
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 503);
  }
  const sb = getServiceClient();
  const max = body.max_messages ?? 500;

  try {
    for await (const msg of graph.iterMessages(body.user_id, body.since_iso)) {
      stats.fetched++;
      await processMessage(sb, msg, stats);
      if (stats.fetched >= max) break;
    }
  } catch (e) {
    if (e instanceof GraphError) {
      return jsonResponse({ error: e.message, partial_stats: stats }, 502);
    }
    throw e;
  }

  return jsonResponse(stats);
});

async function processMessage(sb: any, msg: any, stats: SyncStats): Promise<void> {
  const outlookId = msg.internetMessageId ?? msg.id;
  if (!outlookId) { stats.skipped++; return; }

  // Idempotence
  const { data: existing } = await sb
    .from("interactions")
    .select("id")
    .eq("outlook_msg_id", outlookId)
    .maybeSingle();
  if (existing) { stats.skipped++; return; }

  const fromEmail = msg.from?.emailAddress?.address as string | undefined;
  const fromName = msg.from?.emailAddress?.name as string | undefined;
  const body = msg.body?.content ?? msg.bodyPreview ?? "";
  const subject = msg.subject ?? "";

  // Contact
  let contactId: string | null = null;
  let entrepriseId: string | null = null;
  if (fromEmail) {
    const contact = await upsertContact(sb, fromEmail, fromName, body);
    if (contact.created) stats.new_contacts++;
    contactId = contact.id;
    if (!contact.entreprise_id) {
      const ent = await upsertEntrepriseFromEmail(sb, fromEmail);
      if (ent?.created) stats.new_entreprises++;
      if (ent) {
        entrepriseId = ent.id;
        await sb.from("contacts").update({ entreprise_id: ent.id }).eq("id", contact.id);
      }
    } else {
      entrepriseId = contact.entreprise_id;
    }
  }

  // Interaction
  const occurredAt = msg.receivedDateTime ?? null;
  const signals = extractBusinessSignals(`${subject}\n${body}`);
  await sb.from("interactions").insert({
    type: "email",
    direction: "in",
    contact_id: contactId,
    entreprise_id: entrepriseId,
    sujet: subject.slice(0, 500),
    contenu: body.slice(0, 10_000),
    outlook_msg_id: outlookId,
    metadata: signals.length ? { signals } : null,
    occurred_at: occurredAt,
  });
  stats.new_messages++;

  // Besoin détecté ?
  const need = extractPropertyNeed(`${subject}\n${body}`);
  if (need.typologie || need.surface_min || need.zones.length) {
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
    });
    stats.new_besoins++;
  }
}

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
  }
  const { data: created, error } = await sb
    .from("contacts")
    .insert({
      prenom, nom, email,
      telephone: sig.telephone ?? null,
      poste: sig.poste ?? null,
      source: "outlook",
    })
    .select("id, entreprise_id")
    .single();
  if (error) throw new Error(`upsertContact: ${error.message}`);
  return { id: created.id, entreprise_id: created.entreprise_id, created: true };
}

async function upsertEntrepriseFromEmail(sb: any, email: string) {
  const root = extractCompanyFromEmail(email);
  if (!root) return null;
  const rs = root.replace(/-/g, " ").split(" ").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  const { data: existing } = await sb
    .from("entreprises").select("id").eq("raison_sociale", rs).maybeSingle();
  if (existing) return { id: existing.id, created: false };
  const { data: created, error } = await sb
    .from("entreprises").insert({ raison_sociale: rs }).select("id").single();
  if (error) throw new Error(`upsertEntreprise: ${error.message}`);
  return { id: created.id, created: true };
}
