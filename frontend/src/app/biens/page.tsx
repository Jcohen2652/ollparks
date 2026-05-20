import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function fmtPrice(b: any): string {
  if (b.prix) return `${Number(b.prix).toLocaleString('fr-FR')} €`;
  if (b.loyer_annuel) return `${Number(b.loyer_annuel).toLocaleString('fr-FR')} €/an`;
  return '—';
}

export default async function BiensPage() {
  const sb = await getServerClient();
  const { data: items } = await sb
    .from('biens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  const list = items ?? [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Biens immobiliers</h1>
      <p className="text-slate-600 mb-8">{list.length} biens en catalogue.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3 text-center text-slate-500 py-12">
            Aucun bien en base.
          </Card>
        )}
        {list.map((b: any) => (
          <Card key={b.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-mono text-slate-500">{b.reference}</div>
                <h3 className="font-bold text-lg">{b.ville ?? 'Localisation à préciser'}</h3>
                <div className="text-sm text-slate-500">{b.code_postal}</div>
              </div>
              <div className="flex flex-col gap-1 items-end">
                {b.off_market && <Badge variant="amber">Off-market</Badge>}
                {b.mandat_interne && <Badge variant="blue">Mandat interne</Badge>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-slate-100">
              <div><span className="text-slate-500">Type</span><div className="font-medium">{b.typologie ?? '—'}</div></div>
              <div><span className="text-slate-500">Surface</span><div className="font-medium">{b.surface_m2 ? `${Number(b.surface_m2).toLocaleString('fr-FR')} m²` : '—'}</div></div>
              <div><span className="text-slate-500">Transaction</span><div className="font-medium capitalize">{b.transaction ?? '—'}</div></div>
              <div><span className="text-slate-500">Prix</span><div className="font-medium">{fmtPrice(b)}</div></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
