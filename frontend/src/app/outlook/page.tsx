'use client';

import { useEffect, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Interaction {
  id: string;
  type: string | null;
  direction: string | null;
  sujet: string | null;
  occurred_at: string | null;
}

export default function OutlookPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get<Interaction[]>('/outlook/interactions?limit=100')
      .then(setInteractions)
      .catch(() => setInteractions([]))
      .finally(() => setLoading(false));
  }, []);

  const runSync = async () => {
    if (!userId) return;
    setSyncing(true);
    setMessage(null);
    try {
      const res = await api.post<{
        fetched: number;
        new_messages: number;
        new_contacts: number;
        new_entreprises: number;
        new_besoins: number;
      }>('/outlook/sync', { user_id: userId, max_messages: 200 });
      setMessage(
        `✅ ${res.new_messages} nouveaux messages, ${res.new_contacts} contacts, ${res.new_entreprises} entreprises, ${res.new_besoins} besoins extraits.`,
      );
      const fresh = await api.get<Interaction[]>('/outlook/interactions?limit=100');
      setInteractions(fresh);
    } catch (e) {
      setMessage(`❌ ${e instanceof Error ? e.message : 'Erreur'}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Outlook</h1>
      <p className="text-slate-600 mb-8">
        Ingestion Microsoft Graph → contacts, entreprises, besoins, interactions.
      </p>

      <Card className="mb-6">
        <CardTitle>🔄 Synchronisation</CardTitle>
        <p className="text-sm text-slate-600 mb-4">
          Renseigne l&apos;ID utilisateur Microsoft (UPN ou GUID) à synchroniser. Nécessite les
          credentials Graph configurés côté backend (<code>MICROSOFT_*</code> dans <code>.env</code>).
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">User ID</label>
            <input
              type="text"
              placeholder="user@oll-parks.fr"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <button
            onClick={runSync}
            disabled={!userId || syncing}
            className="px-6 py-2 rounded-lg bg-gradient-to-br from-slate-900 to-blue-700 text-white font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {syncing ? 'Synchronisation…' : 'Lancer le sync'}
          </button>
        </div>
        {message && <p className="text-sm mt-3">{message}</p>}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <CardTitle className="mb-0">Timeline d&apos;interactions ({interactions.length})</CardTitle>
        </div>
        {loading && <p className="px-6 py-8 text-center text-slate-500">Chargement…</p>}
        {!loading && interactions.length === 0 && (
          <p className="px-6 py-8 text-center text-slate-500">
            Aucune interaction. Lance un sync ou attend que le worker fasse l&apos;ingestion.
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {interactions.map((i) => (
            <li key={i.id} className="px-6 py-4 hover:bg-slate-50 flex items-start gap-4">
              <Badge variant={i.direction === 'out' ? 'blue' : 'default'}>
                {i.type ?? 'note'} {i.direction === 'out' ? '↗' : '↙'}
              </Badge>
              <div className="flex-1">
                <div className="font-medium">{i.sujet ?? '(sans sujet)'}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {i.occurred_at ? new Date(i.occurred_at).toLocaleString('fr-FR') : '—'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
