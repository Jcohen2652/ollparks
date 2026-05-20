'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge, ScoreBadge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Proprietaire {
  id: string;
  type: string | null;
  nom: string;
  siren: string | null;
  score: number;
}

export default function ProprietairesPage() {
  const [items, setItems] = useState<Proprietaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get<Proprietaire[]>(`/pappers/proprietaires?min_score=${minScore}&limit=200`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [minScore]);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Propriétaires</h1>
      <p className="text-slate-600 mb-8">
        Issus de Pappers Immo. Score ≥ 80 = cible off-market prioritaire.
      </p>

      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-slate-700">Score minimum</label>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="w-48"
        />
        <span className="text-sm font-mono">{minScore}</span>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading && <p className="px-6 py-8 text-center text-slate-500">Chargement…</p>}
        {!loading && items.length === 0 && (
          <p className="px-6 py-8 text-center text-slate-500">
            Aucun propriétaire. Lance <code>POST /pappers/biens/{'{id}'}/proprietaires</code> sur un bien.
          </p>
        )}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-3 font-semibold">Nom</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">SIREN</th>
              <th className="px-4 py-3 font-semibold">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{p.nom}</td>
                <td className="px-4 py-3"><Badge variant={p.type === 'sci' ? 'amber' : 'default'}>{p.type ?? '—'}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.siren ?? '—'}</td>
                <td className="px-4 py-3"><ScoreBadge score={p.score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
