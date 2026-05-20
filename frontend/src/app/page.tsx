import { Card, CardTitle } from '@/components/ui/Card';
import { getServerClient } from '@/lib/supabase/server';

async function fetchKpis() {
  const sb = await getServerClient();
  const counts = async (table: string, filter?: { col: string; val: string }) => {
    let q = sb.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = q.eq(filter.col, filter.val);
    const { count, error } = await q;
    return error ? '–' : (count ?? 0);
  };
  const [entreprises, biens, besoins, opportunites] = await Promise.all([
    counts('entreprises'),
    counts('biens', { col: 'statut', val: 'disponible' }),
    counts('besoins', { col: 'statut', val: 'actif' }),
    counts('opportunites'),
  ]);
  return { entreprises, biens, besoins, opportunites };
}

export default async function DashboardPage() {
  const kpis = await fetchKpis();
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-slate-600 mb-8">Vue d&apos;ensemble du pipeline OLL PARKS.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="text-3xl font-bold">{kpis.entreprises}</div>
          <div className="text-sm text-slate-600 mt-1">Entreprises</div>
        </Card>
        <Card>
          <div className="text-3xl font-bold">{kpis.biens}</div>
          <div className="text-sm text-slate-600 mt-1">Biens disponibles</div>
        </Card>
        <Card>
          <div className="text-3xl font-bold">{kpis.besoins}</div>
          <div className="text-sm text-slate-600 mt-1">Besoins actifs</div>
        </Card>
        <Card>
          <div className="text-3xl font-bold">{kpis.opportunites}</div>
          <div className="text-sm text-slate-600 mt-1">Opportunités</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>🎯 Top opportunités</CardTitle>
          <p className="text-sm text-slate-600">Lance le matching depuis la page Matching pour voir les scores.</p>
        </Card>
        <Card>
          <CardTitle>📅 RDV à venir</CardTitle>
          <p className="text-sm text-slate-600">Sync Outlook calendrier (Phase 5 — à câbler côté Edge Function).</p>
        </Card>
      </div>
    </div>
  );
}
