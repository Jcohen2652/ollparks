"""
Catalogue de templates de documents.

Chaque template = un fichier Jinja2 (.j2) dans `templates/` + une spec qui décrit
les champs requis et le type de sortie (DOCX/PDF/HTML).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class TemplateSpec:
    key: str
    label: str
    required_fields: list[str] = field(default_factory=list)
    output: str = "pdf"  # 'pdf' | 'docx' | 'html'


TEMPLATES: dict[str, TemplateSpec] = {
    "bon_de_visite": TemplateSpec(
        key="bon_de_visite",
        label="Bon de visite",
        required_fields=[
            "date_visite", "bien.adresse", "bien.reference",
            "prospect.raison_sociale", "prospect.contact_nom",
        ],
    ),
    "denonce_proprietaire": TemplateSpec(
        key="denonce_proprietaire",
        label="Dénonce propriétaire",
        required_fields=[
            "proprietaire.nom", "bien.adresse", "prospect.raison_sociale",
            "date_visite", "agent.nom",
        ],
    ),
    "modalites_visite": TemplateSpec(
        key="modalites_visite",
        label="Modalités de visite",
        required_fields=["date_visite", "bien.adresse", "contact_gardien"],
    ),
    "offre_acquisition": TemplateSpec(
        key="offre_acquisition",
        label="Offre d'acquisition",
        required_fields=[
            "bien.adresse", "bien.reference",
            "prospect.raison_sociale", "prospect.siren",
            "prix_propose", "delai_signature_promesse", "delai_acte_authentique",
        ],
    ),
    "offre_prise_a_bail": TemplateSpec(
        key="offre_prise_a_bail",
        label="Offre de prise à bail",
        required_fields=[
            "bien.adresse", "bien.surface_m2",
            "prospect.raison_sociale", "prospect.siren",
            "loyer_annuel", "depot_garantie", "duree_bail", "franchise_mois",
        ],
    ),
    "lettre_intention": TemplateSpec(
        key="lettre_intention",
        label="Lettre d'intention (LOI)",
        required_fields=["bien.adresse", "prospect.raison_sociale", "intention", "delai_signature_loi"],
    ),
    "mandat": TemplateSpec(
        key="mandat",
        label="Mandat",
        required_fields=["mandant.raison_sociale", "type_mandat", "duree_mandat", "honoraires_pct"],
    ),
    "courrier_proprietaire": TemplateSpec(
        key="courrier_proprietaire",
        label="Courrier propriétaire (off-market)",
        required_fields=["proprietaire.nom", "bien.adresse", "agent.nom", "agent.email"],
    ),
}
