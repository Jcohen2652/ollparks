'use client';

import { useEffect, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getBrowserClient } from '@/lib/supabase/client';

interface EmailAccount {
  id: string;
  provider: 'gmail' | 'outlook';
  email: string;
  last_sync_at: string | null;
  last_sync_stats: Record<string, number> | null;
  sync_status: 'idle' | 'running' | 'error' | 'paused';
  sync_error: string | null;
  revoked_at: string | null;
  created_at: string;
}

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export default function IntegrationsPage() {
  const sb = getBrowserClient();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data } = await sb
      .from('email_accounts')
      .select('*')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    setAccounts((data ?? []) as EmailAccount[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const connectGmail = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('NEXT_PUBLIC_GOOGLE_CLIENT_ID manquant côté frontend');
      return;
    }
    const redirectUri = `${window.location.origin}/auth/gmail/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',  // force le refresh_token
      include_granted_scopes: 'true',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const runSync = async (accountId: string) => {
    setSyncing(accountId);
    setError(null);
    try {
      const { data, error } = await sb.functions.invoke('gmail-sync', {
        body: { account_id: accountId, days: 30, max_messages: 200 },
      });
      if (error) throw error;
      console.log('Sync result:', data);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(null);
    }
  };

  const revoke = async (accountId: string) => {
    if (!confirm('Révoquer ce compte ? Les emails déjà ingérés seront conservés.')) return;
    await sb.from('email_accounts').update({ revoked_at: new Date().toISOString() }).eq('id', accountId);
    await refresh();
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Intégrations</h1>
      <p className="text-slate-600 mb-8">Connecte tes boîtes mail pour ingérer tes contacts et leurs demandes immo.</p>

      {error && <Card className="mb-4 border-red-200 bg-red-50"><p className="text-sm text-red-700">{error}</p></Card>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardTitle>📧 Gmail</CardTitle>
          <p className="text-sm text-slate-600 mb-4">
            Connecte une boîte Gmail (perso ou Workspace). On lira tes emails en lecture seule pour identifier
            contacts, sociétés, demandes immo.
          </p>
          <button
            onClick={connectGmail}
            className="px-6 py-2 rounded-lg bg-gradient-to-br from-slate-900 to-blue-700 text-white font-semibold hover:opacity-90"
          >
            + Connecter une boîte Gmail
          </button>
        </Card>
        <Card className="opacity-60">
          <CardTitle>✉️ Outlook</CardTitle>
          <p className="text-sm text-slate-600 mb-4">
            Microsoft Graph (Outlook 365 / Exchange). Bientôt disponible.
          </p>
          <button disabled className="px-6 py-2 rounded-lg bg-slate-200 text-slate-500 font-semibold cursor-not-allowed">
            Bientôt
          </button>
        </Card>
      </div>

      <h2 className="text-xl font-bold mb-4">Comptes connectés</h2>

      {loading && <p className="text-slate-500">Chargement…</p>}
      {!loading && accounts.length === 0 && (
        <Card className="text-center text-slate-500 py-12">
          Aucun compte connecté. Clique « Connecter une boîte Gmail » ci-dessus pour commencer.
        </Card>
      )}

      <div className="space-y-3">
        {accounts.map((acc) => (
          <Card key={acc.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={acc.provider === 'gmail' ? 'red' : 'blue'}>{acc.provider}</Badge>
                  <span className="font-bold text-lg truncate">{acc.email}</span>
                  <Badge variant={
                    acc.sync_status === 'running' ? 'amber' :
                    acc.sync_status === 'error' ? 'red' :
                    acc.sync_status === 'idle' ? 'green' : 'default'
                  }>
                    {acc.sync_status}
                  </Badge>
                </div>
                {acc.last_sync_at && (
                  <p className="text-xs text-slate-500">
                    Dernier sync : {new Date(acc.last_sync_at).toLocaleString('fr-FR')}
                  </p>
                )}
                {acc.last_sync_stats && (
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    {Object.entries(acc.last_sync_stats).filter(([k]) => k !== 'account_id').map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {k}: <strong>{v}</strong>
                      </span>
                    ))}
                  </div>
                )}
                {acc.sync_error && (
                  <p className="text-xs text-red-600 mt-2">⚠️ {acc.sync_error}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => runSync(acc.id)}
                  disabled={syncing !== null}
                  className="px-4 py-1.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {syncing === acc.id ? 'Sync…' : '🔄 Sync 30j'}
                </button>
                <button
                  onClick={() => revoke(acc.id)}
                  className="px-4 py-1.5 rounded-md border border-slate-300 text-slate-600 text-sm hover:bg-slate-50"
                >
                  Révoquer
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
