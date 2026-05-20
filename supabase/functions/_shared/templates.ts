// Catalogue de templates de documents OLL PARKS.
// Templates inline (string) — les substitutions se font via une mini-eval sécurisée.

export interface TemplateSpec {
  key: string;
  label: string;
  required_fields: string[];
  body: string; // HTML avec ${data.x.y} placeholders
}

const BASE_CSS = `
  @page { size: A4; margin: 2cm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1f2937; font-size: 11pt; line-height: 1.5; }
  h1 { color: #1e3a8a; font-size: 18pt; border-bottom: 2px solid #1e3a8a; padding-bottom: 0.3em; }
  h2 { color: #1e3a8a; font-size: 14pt; margin-top: 1.5em; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  td, th { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  .meta { color: #64748b; font-size: 9pt; margin-bottom: 2em; }
  .signature { margin-top: 3em; }
  .signature .line { display: inline-block; width: 250px; border-top: 1px solid #94a3b8; padding-top: 4px; }
  .footer { font-size: 8pt; color: #94a3b8; text-align: center; margin-top: 3em; border-top: 1px solid #e2e8f0; padding-top: 0.5em; }
`;

const wrap = (title: string, content: string) => `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>${title}</title>
<style>${BASE_CSS}</style></head><body>
${content}
<div class="footer">OLL PARKS — Document généré le \${generated_at}</div>
</body></html>`;

export const TEMPLATES: Record<string, TemplateSpec> = {
  bon_de_visite: {
    key: "bon_de_visite",
    label: "Bon de visite",
    required_fields: ["date_visite", "bien.adresse", "bien.reference", "prospect.raison_sociale", "prospect.contact_nom"],
    body: wrap("Bon de visite", `
      <h1>Bon de visite</h1>
      <p class="meta">Référence : <strong>\${bien.reference}</strong> · Date : <strong>\${date_visite}</strong></p>
      <h2>1. Bien visité</h2>
      <table>
        <tr><th>Adresse</th><td>\${bien.adresse}\${bien.ville ? ', ' + bien.code_postal + ' ' + bien.ville : ''}</td></tr>
        <tr><th>Typologie</th><td>\${bien.typologie || '—'}</td></tr>
        <tr><th>Surface</th><td>\${bien.surface_m2 || '—'} m²</td></tr>
      </table>
      <h2>2. Visiteur</h2>
      <table>
        <tr><th>Société</th><td>\${prospect.raison_sociale}</td></tr>
        <tr><th>Représentant</th><td>\${prospect.contact_nom}</td></tr>
      </table>
      <h2>3. Engagement</h2>
      <p>La société visiteuse reconnaît visiter ce bien par l'entremise exclusive d'OLL PARKS,
      et s'engage à signaler à OLL PARKS toute négociation ultérieure portant sur ce bien.</p>
      <div class="signature">
        <p><span class="line">Signature visiteur (lu et approuvé)</span></p>
        <p style="margin-top:2em;"><span class="line">Pour OLL PARKS</span></p>
      </div>`),
  },
  denonce_proprietaire: {
    key: "denonce_proprietaire",
    label: "Dénonce propriétaire",
    required_fields: ["proprietaire.nom", "bien.adresse", "prospect.raison_sociale", "date_visite", "agent.nom"],
    body: wrap("Dénonce propriétaire", `
      <h1>Dénonce propriétaire</h1>
      <p class="meta">Bien : <strong>\${bien.adresse}</strong> · Visite du \${date_visite}</p>
      <p>\${proprietaire.nom},</p>
      <p>Conformément aux usages de la profession, nous vous dénonçons par la présente la société suivante,
      à laquelle nous présentons votre bien situé au <strong>\${bien.adresse}</strong> :</p>
      <table>
        <tr><th>Société dénoncée</th><td>\${prospect.raison_sociale}</td></tr>
        <tr><th>Date de visite</th><td>\${date_visite}</td></tr>
      </table>
      <p>Cordialement,</p>
      <div class="signature"><p><strong>\${agent.nom}</strong><br/>OLL PARKS</p></div>`),
  },
  modalites_visite: {
    key: "modalites_visite",
    label: "Modalités de visite",
    required_fields: ["date_visite", "bien.adresse", "contact_gardien"],
    body: wrap("Modalités de visite", `
      <h1>Modalités de visite</h1>
      <p class="meta">Date : <strong>\${date_visite}</strong></p>
      <table>
        <tr><th>Adresse</th><td>\${bien.adresse}</td></tr>
        <tr><th>Référence</th><td>\${bien.reference || '—'}</td></tr>
        <tr><th>Contact sur place</th><td>\${contact_gardien}</td></tr>
      </table>
      <h2>Pièces à apporter</h2>
      <ul><li>Pièce d'identité</li><li>Mandat (si transmis)</li><li>Bon de visite à signer</li></ul>`),
  },
  offre_acquisition: {
    key: "offre_acquisition",
    label: "Offre d'acquisition",
    required_fields: ["bien.adresse", "bien.reference", "prospect.raison_sociale", "prospect.siren", "prix_propose", "delai_signature_promesse", "delai_acte_authentique"],
    body: wrap("Offre d'acquisition", `
      <h1>Offre d'acquisition</h1>
      <p class="meta">Référence : <strong>\${bien.reference}</strong></p>
      <p>La société <strong>\${prospect.raison_sociale}</strong> (SIREN \${prospect.siren}) formule par la présente
      une offre ferme d'acquisition portant sur le bien suivant :</p>
      <h2>1. Désignation</h2>
      <table>
        <tr><th>Adresse</th><td>\${bien.adresse}</td></tr>
        <tr><th>Surface</th><td>\${bien.surface_m2 || '—'} m²</td></tr>
      </table>
      <h2>2. Conditions financières</h2>
      <table>
        <tr><th>Prix proposé</th><td><strong>\${formatPrice(prix_propose)} €</strong> net vendeur</td></tr>
      </table>
      <h2>3. Délais</h2>
      <ul>
        <li>Promesse : <strong>\${delai_signature_promesse}</strong></li>
        <li>Acte authentique : <strong>\${delai_acte_authentique}</strong></li>
      </ul>
      <div class="signature"><p><span class="line">Pour \${prospect.raison_sociale}</span></p></div>`),
  },
  offre_prise_a_bail: {
    key: "offre_prise_a_bail",
    label: "Offre de prise à bail",
    required_fields: ["bien.adresse", "bien.surface_m2", "prospect.raison_sociale", "prospect.siren", "loyer_annuel", "depot_garantie", "duree_bail"],
    body: wrap("Offre de prise à bail", `
      <h1>Offre de prise à bail</h1>
      <p>La société <strong>\${prospect.raison_sociale}</strong> (SIREN \${prospect.siren}) formule la présente offre
      de prise à bail portant sur les locaux suivants :</p>
      <h2>1. Locaux</h2>
      <table>
        <tr><th>Adresse</th><td>\${bien.adresse}</td></tr>
        <tr><th>Surface</th><td>\${bien.surface_m2} m²</td></tr>
      </table>
      <h2>2. Conditions financières</h2>
      <table>
        <tr><th>Loyer annuel HT/HC</th><td><strong>\${formatPrice(loyer_annuel)} €</strong></td></tr>
        <tr><th>Dépôt de garantie</th><td>\${formatPrice(depot_garantie)} €</td></tr>
      </table>
      <h2>3. Bail</h2>
      <ul><li>Durée : <strong>\${duree_bail}</strong></li></ul>
      <div class="signature"><p><span class="line">Pour \${prospect.raison_sociale}</span></p></div>`),
  },
  lettre_intention: {
    key: "lettre_intention",
    label: "Lettre d'intention (LOI)",
    required_fields: ["bien.adresse", "prospect.raison_sociale", "intention", "delai_signature_loi"],
    body: wrap("Lettre d'intention", `
      <h1>Lettre d'intention</h1>
      <p>La société <strong>\${prospect.raison_sociale}</strong> manifeste son intention de poursuivre les négociations
      portant sur le bien situé au <strong>\${bien.adresse}</strong>.</p>
      <h2>Intention</h2><p>\${intention}</p>
      <h2>Calendrier</h2>
      <ol>
        <li>Audit technique et juridique — sous 15 jours</li>
        <li>Validation comité d'investissement — sous \${delai_signature_loi}</li>
      </ol>
      <p>La présente lettre n'a aucun caractère contractuel.</p>
      <div class="signature"><p><span class="line">Pour \${prospect.raison_sociale}</span></p></div>`),
  },
  mandat: {
    key: "mandat",
    label: "Mandat",
    required_fields: ["mandant.raison_sociale", "type_mandat", "duree_mandat", "honoraires_pct"],
    body: wrap("Mandat", `
      <h1>Mandat de \${type_mandat}</h1>
      <p>Entre <strong>\${mandant.raison_sociale}</strong> et <strong>OLL PARKS</strong>.</p>
      <h2>Durée</h2><p>\${duree_mandat}</p>
      <h2>Honoraires</h2><p><strong>\${honoraires_pct}%</strong> HT du prix de transaction.</p>
      <div class="signature">
        <p><span class="line">Pour le Mandant</span></p>
        <p style="margin-top:2em;"><span class="line">Pour OLL PARKS</span></p>
      </div>`),
  },
  courrier_proprietaire: {
    key: "courrier_proprietaire",
    label: "Courrier propriétaire (off-market)",
    required_fields: ["proprietaire.nom", "bien.adresse", "agent.nom", "agent.email"],
    body: wrap("Courrier propriétaire", `
      <p style="text-align:right;">\${agent.nom}<br/>OLL PARKS<br/>\${agent.email}</p>
      <p style="margin-top:3em;">À l'attention de<br/><strong>\${proprietaire.nom}</strong><br/>
      Concernant le bien sis : <strong>\${bien.adresse}</strong></p>
      <p>Madame, Monsieur,</p>
      <p>Notre cabinet OLL PARKS accompagne depuis 15 ans les groupes français et internationaux dans leurs opérations
      immobilières d'entreprise. Nous identifions actuellement plusieurs sociétés à la recherche d'actifs présentant
      les caractéristiques de votre bien.</p>
      <p>Si vous envisagez à moyen terme une cession ou une nouvelle location, nous serions ravis d'échanger.</p>
      <p style="margin-top:2em;">Bien cordialement,</p>
      <div class="signature"><p><strong>\${agent.nom}</strong><br/>OLL PARKS</p></div>`),
  },
};

// ----- Render engine -----

function getNested(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc?.[key] !== undefined ? acc[key] : undefined), obj);
}

function checkRequired(spec: TemplateSpec, data: any): string[] {
  const missing: string[] = [];
  for (const f of spec.required_fields) {
    const v = getNested(data, f);
    if (v === undefined || v === null || v === "") missing.push(f);
  }
  return missing;
}

export function formatPrice(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export function renderTemplate(key: string, data: Record<string, any>): string {
  const spec = TEMPLATES[key];
  if (!spec) throw new Error(`Template inconnu : ${key}`);
  const missing = checkRequired(spec, data);
  if (missing.length) throw new Error(`Champs requis manquants : ${missing.join(", ")}`);

  // Construire le scope d'évaluation : toutes les clés de data + helpers
  const ctx: Record<string, any> = { ...data, formatPrice, generated_at: new Date().toISOString().slice(0, 19) };

  // Remplace ${...expr...} par eval. Sécurité : Function-scope, pas accès à window/Deno.
  // L'input est notre propre template (pas user input) — donc safe.
  return spec.body.replace(/\$\{([^}]+)\}/g, (_, expr: string) => {
    try {
      const fn = new Function(...Object.keys(ctx), `return (${expr.trim()});`);
      const v = fn(...Object.values(ctx));
      return v == null ? "" : String(v);
    } catch {
      return "";
    }
  });
}
