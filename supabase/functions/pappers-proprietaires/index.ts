// POST /functions/v1/pappers-proprietaires
// Body : { bien_id: string }
// Identifie les propriétaires d'un bien via Pappers Immo + crée les rows
// proprietaires + biens_proprietaires.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { PappersClient, PappersError, scoreProprietaire } from "../_shared/pappers.ts";

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  const { bien_id } = await req.json().catch(() => ({}));
  if (!bien_id) return jsonResponse({ error: "bien_id requis" }, 400);

  const sb = getServiceClient();
  const { data: bien } = await sb.from("biens").select("*").eq("id", bien_id).single();
  if (!bien || !bien.adresse || !bien.code_postal) {
    return jsonResponse({ error: "Bien sans adresse complète" }, 400);
  }

  let client: PappersClient;
  try { client = PappersClient.fromEnv(); }
  catch (e) { return jsonResponse({ error: (e as Error).message }, 503); }

  const found = await client.proprietairesParAdresse(bien.adresse, bien.code_postal, bien.ville);
  const out: any[] = [];
  for (const p of found) {
    if (!p.nom) continue;

    // Find existing
    let existing = null;
    if (p.siren) {
      const r = await sb.from("proprietaires").select("*").eq("siren", p.siren).maybeSingle();
      existing = r.data;
    }
    if (!existing) {
      const r = await sb.from("proprietaires").select("*").eq("nom", p.nom).maybeSingle();
      existing = r.data;
    }
    if (!existing) {
      const score = scoreProprietaire({
        type: p.type,
        date_creation: p.raw?.date_creation,
        nb_biens_detenus: p.raw?.nb_biens_detenus,
        capital: p.raw?.capital,
      });
      const { data: created, error } = await sb.from("proprietaires").insert({
        type: p.type,
        nom: p.nom,
        siren: p.siren,
        pappers_id: p.pappers_id,
        score,
      }).select("*").single();
      if (error) return jsonResponse({ error: error.message }, 500);
      existing = created;
    }

    // Lien bien-propriétaire (idempotent)
    await sb.from("biens_proprietaires").upsert(
      { bien_id, proprietaire_id: existing.id },
      { onConflict: "bien_id,proprietaire_id", ignoreDuplicates: true },
    );

    out.push({
      id: existing.id, type: existing.type, nom: existing.nom,
      siren: existing.siren, score: existing.score,
    });
  }

  return jsonResponse(out);
});
