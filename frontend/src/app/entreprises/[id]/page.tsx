import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge, ScoreBadge } from '@/components/ui/Badge';

interface EntrepriseDetail {
  entreprise: {
    id: string;
    raison_sociale: string;
    siren: string | null;
    secteur: string | null;
    effectif: number | null;
    score: number;
  };
  contacts: Array<{ id: string; nom: string; email: string | null; poste: string | null; score: number }>;
  besoins: Array<{ id: string; typologie: string | null; surface_min: number | null; surface_max: number | null; zones: string[] | null; statut: string }>;
  interactions_count: number;
  last_interaction_at: string | null;
  opportunites_count: number;
}

async function fetchDetail(id: string): Promise<EntrepriseDetail | null> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  try {
    const res = await fetch(`${base}/crm/entreprises/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function EntrepriseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchDetail(id);
  if (!data) return <p className="text-slate-500">Entreprise introuvable.</p>;

  const e = data.entreprise;

  return (
    <div>
      <Link href="/entreprises" className="text-sm text-blue-600 hover:underline">← Toutes les entreprises</Link>
      <div className="flex items-center justify-between mt-2 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{e.raison_sociale}</h1>
          <p className="text-slate-600 font-mono text-sm">SIREN {e.siren ?? '—'}</p>
        </div>
        <ScoreBadge score={e.score} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="text-center">
          <div className="text-2xl font-bold">{e.effectif?.toLocaleString('fr-FR') ?? '—'}</div>
          <div className="text-xs text-slate-600">Effectif</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold">{data.contacts.length}</div>
          <div className="text-xs text-slate-600">Contacts</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold">{data.interactions_count}</div>
          <div className="text-xs text-slate-600">Interactions</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold">{data.opportunites_count}</div>
          <div className="text-xs text-slate-600">Opportunités</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <CardTitle className="mb-0">👥 Contacts</CardTitle>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.contacts.length === 0 && (
              <li className="px-6 py-8 text-center text-slate-500 text-sm">Aucun contact</li>
            )}
            {data.contacts.map((c) => (
              <li key={c.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.nom || c.email}</div>
                  <div className="text-xs text-slate-600">
                    {c.poste ?? '—'} · {c.email ?? 'sans email'}
                  </div>
                </div>
                <ScoreBadge score={c.score} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <CardTitle className="mb-0">🔍 Besoins immobiliers</CardTitle>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.besoins.length === 0 && (
              <li className="px-6 py-8 text-center text-slate-500 text-sm">Aucun besoin actif</li>
            )}
            {data.besoins.map((b) => (
              <li key={b.id} className="px-6 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="blue">{b.typologie ?? '—'}</Badge>
                  <Badge variant={b.statut === 'actif' ? 'green' : 'default'}>{b.statut}</Badge>
                </div>
                <div className="text-sm text-slate-600">
                  {b.surface_min ?? '?'}–{b.surface_max ?? '?'} m² · {b.zones?.join(', ') ?? '—'}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
