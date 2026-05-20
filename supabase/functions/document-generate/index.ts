// POST /functions/v1/document-generate
// Body : { template: string, data: object, format?: 'html'|'pdf' }
//
// Génère un document OLL PARKS et le renvoie inline.
// Si format=pdf, on utilise une lib PDF Deno (jsPDF via CDN n'est pas idéal en Edge —
// pour la v1 on renvoie HTML, le frontend peut imprimer en PDF via window.print()).

import { handleOptions, jsonResponse, corsHeaders } from "../_shared/cors.ts";
import { renderTemplate, TEMPLATES } from "../_shared/templates.ts";

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  // GET /document-generate => retourne le catalogue
  if (req.method === "GET") {
    return jsonResponse(
      Object.values(TEMPLATES).map((t) => ({
        key: t.key, label: t.label, required_fields: t.required_fields,
      })),
    );
  }

  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  let body: { template: string; data: any; format?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON invalide" }, 400);
  }
  if (!body.template) return jsonResponse({ error: "template requis" }, 400);

  let html: string;
  try {
    html = renderTemplate(body.template, body.data ?? {});
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }

  if (body.format === "pdf") {
    // Note : génération PDF côté serveur Deno = lourd (besoin d'un service externe ou WASM).
    // Pour la v1, on renvoie HTML avec instructions pour print → PDF côté client.
    // Une v2 utilisera browserless.io ou un service de rendu PDF dédié.
    return jsonResponse(
      { error: "PDF non implémenté côté Edge — utiliser format=html + window.print() côté client" },
      501,
    );
  }

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${body.template}.html"`,
    },
  });
});
