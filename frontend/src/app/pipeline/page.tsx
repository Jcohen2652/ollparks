'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge, ScoreBadge } from '@/components/ui/Badge';
import { getBrowserClient } from '@/lib/supabase/client';

interface PipelineItem {
  id: string;
  besoin_id: string;
  bien_id: string;
  score: number | null;
  action_recommandee: string | null;
}

interface PipelineColumn {
  statut: string;
  items: PipelineItem[];
}

const STATUTS = ['nouveau', 'qualifié', 'proposé', 'visite', 'offre', 'signé', 'perdu'];

const STATUT_COLORS: Record<string, string> = {
  nouveau:   'bg-slate-100 border-slate-300',
  qualifié:  'bg-blue-50 border-blue-300',
  proposé:   'bg-amber-50 border-amber-300',
  visite:    'bg-purple-50 border-purple-300',
  offre:     'bg-orange-50 border-orange-300',
  signé:     'bg-green-50 border-green-300',
  perdu:     'bg-red-50 border-red-300',
};

export default function PipelinePage() {
  const sb = getBrowserClient();
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await sb
      .from('opportunites')
      .select('id, besoin_id, bien_id, score, statut, action_recommandee')
      .order('score', { ascending: false, nullsFirst: false });
    const grouped: PipelineColumn[] = STATUTS.map((s) => ({
      statut: s,
      items: ((data ?? []) as any[])
        .filter((o) => o.statut === s)
        .map((o) => ({
          id: o.id,
          besoin_id: o.besoin_id,
          bien_id: o.bien_id,
          score: o.score,
          action_recommandee: o.action_recommandee,
        })),
    }));
    setColumns(grouped);
  }, [sb]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const moveStatus = async (oppId: string, newStatus: string) => {
    const { error } = await sb.from('opportunites').update({ statut: newStatus }).eq('id', oppId);
    if (error) {
      console.error(error);
      return;
    }
    await refresh();
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Pipeline commercial</h1>
      <p className="text-slate-600 mb-8">
        Opportunités groupées par statut. Clique sur les flèches pour faire avancer.
      </p>

      {loading && <p className="text-slate-500">Chargement…</p>}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col, idx) => (
          <div
            key={col.statut}
            className={`flex-shrink-0 w-72 rounded-xl border-2 ${STATUT_COLORS[col.statut] ?? 'bg-slate-50 border-slate-200'}`}
          >
            <div className="px-4 py-3 border-b border-slate-200/50 flex items-center justify-between">
              <h3 className="font-semibold capitalize">{col.statut}</h3>
              <span className="text-sm text-slate-600">{col.items.length}</span>
            </div>
            <div className="p-3 space-y-2 min-h-[200px]">
              {col.items.map((item) => (
                <Card key={item.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    {item.score !== null && <ScoreBadge score={item.score} />}
                    {item.action_recommandee && (
                      <Badge variant="default">{item.action_recommandee}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate">
                    {item.bien_id.slice(0, 8)}… ↔ {item.besoin_id.slice(0, 8)}…
                  </div>
                  <div className="flex justify-between text-xs">
                    {idx > 0 && (
                      <button
                        className="text-slate-500 hover:text-slate-900"
                        onClick={() => moveStatus(item.id, columns[idx - 1].statut)}
                      >
                        ← {columns[idx - 1].statut}
                      </button>
                    )}
                    {idx < columns.length - 1 && (
                      <button
                        className="ml-auto text-slate-500 hover:text-slate-900"
                        onClick={() => moveStatus(item.id, columns[idx + 1].statut)}
                      >
                        {columns[idx + 1].statut} →
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
