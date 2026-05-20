'use client';

import { useEffect, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Visite {
  id: string;
  bien_id: string | null;
  date_visite: string | null;
  statut: string;
  bon_de_visite_url: string | null;
  denonce_url: string | null;
  modalites_url: string | null;
  notes: string | null;
}

const DOC_TYPES = [
  { key: 'bon_de_visite', label: 'Bon de visite' },
  { key: 'denonce_proprietaire', label: 'Dénonce' },
  { key: 'modalites_visite', label: 'Modalités' },
];

export default function VisitesPage() {
  const [items, setItems] = useState<Visite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<Visite[]>('/visites?limit=100')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const getDocUrl = (visiteId: string, docType: string, format = 'pdf') => {
    const base = process.env.NEXT_PUBLIC_API_URL || '/api';
    return `${base}/visites/${visiteId}/documents/${docType}?format=${format}`;
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Visites</h1>
      <p className="text-slate-600 mb-8">
        Génération automatique des bons de visite, dénonces propriétaire et modalités.
      </p>

      {loading && <p className="text-slate-500">Chargement…</p>}
      {!loading && items.length === 0 && (
        <Card className="text-center text-slate-500 py-12">
          Aucune visite. Crée-en une via <code>POST /visites</code>.
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((v) => (
          <Card key={v.id} className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500">Visite</div>
                <div className="font-bold text-lg">
                  {v.date_visite ? new Date(v.date_visite).toLocaleString('fr-FR') : '—'}
                </div>
              </div>
              <Badge variant={v.statut === 'planifiée' ? 'blue' : 'default'}>{v.statut}</Badge>
            </div>
            {v.notes && <p className="text-sm text-slate-600">{v.notes}</p>}
            <div className="pt-3 border-t border-slate-100">
              <CardTitle className="text-sm mb-2">Documents</CardTitle>
              <div className="flex flex-wrap gap-2">
                {DOC_TYPES.map((d) => (
                  <a
                    key={d.key}
                    href={getDocUrl(v.id, d.key, 'pdf')}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200"
                  >
                    📄 {d.label}
                  </a>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
