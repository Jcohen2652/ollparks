export interface Entreprise {
  id: string;
  raison_sociale: string;
  siren: string | null;
  secteur: string | null;
  effectif: number | null;
  ca: string | null;
  score: number;
  created_at: string;
}

export interface Contact {
  id: string;
  entreprise_id: string | null;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  poste: string | null;
  role_immo: string | null;
  score: number;
}

export interface Bien {
  id: string;
  reference: string | null;
  typologie: string | null;
  statut: string;
  transaction: string | null;
  surface_m2: string | null;
  prix: string | null;
  loyer_annuel: string | null;
  ville: string | null;
  code_postal: string | null;
  off_market: boolean;
  mandat_interne: boolean;
}

export interface Besoin {
  id: string;
  entreprise_id: string | null;
  typologie: string | null;
  surface_min: string | null;
  surface_max: string | null;
  budget_min: string | null;
  budget_max: string | null;
  zones: string[] | null;
  timing: string | null;
  statut: string;
}

export interface MatchResultItem {
  bien_id: string;
  score: number;
  score_detail: Record<string, number>;
  action: string;
}

export interface MatchResponse {
  besoin_id: string;
  results: MatchResultItem[];
}
