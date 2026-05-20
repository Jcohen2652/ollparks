'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Rdv {
  id: string;
  titre: string | null;
  debut: string;
  fin: string;
  lieu: string | null;
  statut: string;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay() || 7;
  const w = new Date(d);
  w.setDate(d.getDate() - day + 1);
  w.setHours(0, 0, 0, 0);
  return w;
}

export default function AgendaPage() {
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    setLoading(true);
    const debut = weekStart.toISOString();
    const fin = new Date(weekStart.getTime() + 7 * 86_400_000).toISOString();
    api.get<Rdv[]>(`/agenda?debut=${debut}&fin=${fin}&limit=200`)
      .then(setRdvs)
      .catch(() => setRdvs([]))
      .finally(() => setLoading(false));
  }, [weekStart]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86_400_000)),
    [weekStart],
  );

  const rdvsByDay = useMemo(() => {
    const map: Record<string, Rdv[]> = {};
    for (const r of rdvs) {
      const key = new Date(r.debut).toDateString();
      (map[key] ||= []).push(r);
    }
    return map;
  }, [rdvs]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Agenda</h1>
          <p className="text-slate-600">Semaine du {weekStart.toLocaleDateString('fr-FR')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86_400_000))}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
          >
            ←
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
          >
            Aujourd&apos;hui
          </button>
          <button
            onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86_400_000))}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
          >
            →
          </button>
        </div>
      </div>

      {loading && <p className="text-slate-500">Chargement…</p>}

      <div className="grid grid-cols-7 gap-3">
        {days.map((d) => {
          const items = rdvsByDay[d.toDateString()] ?? [];
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <Card
              key={d.toISOString()}
              className={isToday ? 'border-blue-400 bg-blue-50/30 min-h-[200px]' : 'min-h-[200px]'}
            >
              <div className="text-xs text-slate-500 uppercase">
                {d.toLocaleDateString('fr-FR', { weekday: 'short' })}
              </div>
              <div className="text-2xl font-bold mb-2">{d.getDate()}</div>
              <div className="space-y-2">
                {items.map((r) => (
                  <div key={r.id} className="text-xs p-2 rounded bg-blue-100 border-l-2 border-blue-500">
                    <div className="font-medium">{r.titre ?? 'RDV'}</div>
                    <div className="text-slate-600">
                      {new Date(r.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {r.lieu && <div className="text-slate-500 truncate">{r.lieu}</div>}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        <Badge variant="blue">Sync Outlook</Badge>
        <span>POST /agenda/sync-outlook?user_id=… synchronise le calendrier Microsoft 365.</span>
      </div>
    </div>
  );
}
