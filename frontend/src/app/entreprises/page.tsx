import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { ScoreBadge } from '@/components/ui/Badge';
import { getServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function EntreprisesPage() {
  const sb = await getServerClient();
  const { data: items } = await sb
    .from('entreprises')
    .select('*')
    .order('score', { ascending: false })
    .limit(200);

  const list = items ?? [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Entreprises</h1>
      <p className="text-slate-600 mb-8">{list.length} entreprises en base.</p>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-3 font-semibold">Raison sociale</th>
              <th className="px-4 py-3 font-semibold">SIREN</th>
              <th className="px-4 py-3 font-semibold">Secteur</th>
              <th className="px-4 py-3 font-semibold">Effectif</th>
              <th className="px-4 py-3 font-semibold">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Aucune entreprise.
                </td>
              </tr>
            )}
            {list.map((e: any) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/entreprises/${e.id}`} className="text-blue-600 hover:underline">
                    {e.raison_sociale}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{e.siren ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{e.secteur ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{e.effectif?.toLocaleString('fr-FR') ?? '—'}</td>
                <td className="px-4 py-3"><ScoreBadge score={e.score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
