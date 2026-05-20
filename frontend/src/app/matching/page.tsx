'use client';

import { useEffect, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge, ScoreBadge } from '@/components/ui/Badge';
import { getBrowserClient } from '@/lib/supabase/client';

interface Besoin {
  id: string;
  typologie: string | null;
  surface_min: number | null;
  surface_max: number | null;
  zones: string[] | null;
}

interface MatchItem {
  bien_id: string;
  score: number;
  score_detail: Record<string, number>;
  action: string;
}

const ACTION_VARIANT: Record<string, 'red' | 'amber' | 'blue' | 'default'> = {
  appel_immediat: 'red',
  envoi_fiche: 'amber',
  qualification: 'blue',
  veille: 'default',
};

const ACTION_LABEL: Record<string, string> = {
  appel_immediat: '🔥 Appel immédiat',
  envoi_fiche: '📧 Envoi fiche',
  qualification: '🔍 Qualification',
  veille: '👀 Veille',
};

export default function MatchingPage() {
  const sb = getBrowserClient();
  const [besoins, setBesoins] = useState<Besoin[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [results, setResults] = useState<MatchItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sb.from('besoins').select('id, typologie, surface_min, surface_max, zones')
      .eq('statut', 'actif').limit(100)
      .then(({ data }) => setBesoins(data ?? []));
  }, []);

  const runMatch = async () => {
    if (!selected) return;
    setLoading(true); setError(null);
    const { data, error } = await sb.functions.invoke('matching', {
      body: { besoin_id: selected, top_n: 20 },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setResults((data as any).results);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Matching intelligent</h1>
      <p className="text-slate-600 mb-8">
        Sélectionne un besoin, lance le moteur, obtiens les biens scorés /100.
      </p>

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">Besoin à matcher</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">— Sélectionner —</option>
              {besoins.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.typologie ?? '—'} · {b.surface_min ?? '?'}-{b.surface_max ?? '?'} m² · {b.zones?.join(', ') ?? '?'}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={runMatch}
            disabled={!selected || loading}
            className="px-6 py-2 rounded-lg bg-gradient-to-br from-slate-900 to-blue-700 text-white font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'Calcul…' : 'Lancer le matching'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </Card>

      {results && (
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <CardTitle className="mb-0">{results.length} biens scorés</CardTitle>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">Bien</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Détail</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((r) => (
                <tr key={r.bien_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.bien_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3"><ScoreBadge score={r.score} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 text-xs">
                      {Object.entries(r.score_detail).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ACTION_VARIANT[r.action] ?? 'default'}>
                      {ACTION_LABEL[r.action] ?? r.action}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
