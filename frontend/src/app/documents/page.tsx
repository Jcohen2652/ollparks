'use client';

import { useEffect, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface TemplateInfo {
  key: string;
  label: string;
  required_fields: string[];
  output: string;
}

export default function DocumentsPage() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selected, setSelected] = useState<TemplateInfo | null>(null);
  const [data, setData] = useState('{\n}');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<TemplateInfo[]>('/documents/templates')
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  const generate = async (format: 'pdf' | 'html' | 'docx') => {
    if (!selected) return;
    setError(null);
    try {
      const parsed = JSON.parse(data);
      const base = process.env.NEXT_PUBLIC_API_URL || '/api';
      const res = await fetch(`${base}/documents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: selected.key, data: parsed, format }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Documents</h1>
      <p className="text-slate-600 mb-8">
        8 templates dynamiques. Sélectionne, remplis le JSON, génère en PDF / HTML / DOCX.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardTitle>Catalogue</CardTitle>
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.key}>
                <button
                  onClick={() => setSelected(t)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selected?.key === t.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-sm">{t.label}</div>
                  <div className="text-xs text-slate-500 font-mono">{t.key}</div>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          {selected ? (
            <>
              <CardTitle>{selected.label}</CardTitle>
              <div className="mb-3">
                <div className="text-xs text-slate-500 mb-1">Champs requis :</div>
                <div className="flex flex-wrap gap-1">
                  {selected.required_fields.map((f) => (
                    <Badge key={f} variant="amber">{f}</Badge>
                  ))}
                </div>
              </div>
              <label className="block text-sm font-medium mt-4 mb-1">Données (JSON)</label>
              <textarea
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full h-64 font-mono text-xs rounded-lg border border-slate-300 p-3"
              />
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={() => generate('pdf')} className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:opacity-90">
                  📄 PDF
                </button>
                <button onClick={() => generate('docx')} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:opacity-90">
                  📝 DOCX
                </button>
                <button onClick={() => generate('html')} className="px-4 py-2 rounded-lg border border-slate-300 font-semibold text-sm hover:bg-slate-50">
                  🌐 HTML
                </button>
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-center py-12">Sélectionne un template à gauche.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
