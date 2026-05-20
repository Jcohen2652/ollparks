'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { getBrowserClient } from '@/lib/supabase/client';

export default function GmailCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sb = getBrowserClient();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState<string>('Échange du code OAuth…');

  useEffect(() => {
    const code = params.get('code');
    const errorParam = params.get('error');
    if (errorParam) {
      setStatus('error');
      setMessage(`Google a refusé : ${errorParam}`);
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('Pas de code OAuth dans l\'URL');
      return;
    }
    const redirectUri = `${window.location.origin}/auth/gmail/callback`;
    sb.functions.invoke('gmail-oauth-callback', {
      body: {
        code,
        redirect_uri: redirectUri,
        consent_text: 'OLL PARKS — accès lecture seule à Gmail pour ingestion CRM',
      },
    }).then(({ data, error }) => {
      if (error) {
        setStatus('error');
        setMessage(error.message);
        return;
      }
      setStatus('success');
      setMessage(`Compte ${data.email} connecté ! Redirection…`);
      setTimeout(() => router.push('/integrations'), 2000);
    }).catch((e) => {
      setStatus('error');
      setMessage(String(e));
    });
  }, [params, router, sb]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-lg w-full text-center">
        <CardTitle>
          {status === 'processing' && '⏳ Connexion en cours…'}
          {status === 'success' && '✅ Connecté'}
          {status === 'error' && '❌ Erreur'}
        </CardTitle>
        <p className="text-slate-600 mt-2">{message}</p>
        {status === 'error' && (
          <button
            onClick={() => router.push('/integrations')}
            className="mt-6 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
          >
            Retour
          </button>
        )}
      </Card>
    </div>
  );
}
