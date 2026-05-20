'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const router = useRouter();
  const supabase = getBrowserClient();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const fn = mode === 'signin' ? supabase.auth.signInWithPassword.bind(supabase.auth)
                                 : supabase.auth.signUp.bind(supabase.auth);
    const { error } = await fn({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-900 to-blue-700 flex items-center justify-center text-white font-bold">O</div>
          <span className="font-bold text-lg">OLL PARKS</span>
        </div>
        <h1 className="text-2xl font-bold mb-1">{mode === 'signin' ? 'Connexion' : 'Créer un compte'}</h1>
        <p className="text-sm text-slate-600 mb-6">
          {mode === 'signin' ? 'Accède à ta plateforme.' : 'Inscris-toi avec ton email pro.'}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mot de passe</label>
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-gradient-to-br from-slate-900 to-blue-700 text-white font-semibold disabled:opacity-40"
          >
            {loading ? '…' : (mode === 'signin' ? 'Se connecter' : "S'inscrire")}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          {mode === 'signin' ? "Pas de compte ? S'inscrire" : 'Déjà inscrit ? Se connecter'}
        </button>
      </Card>
    </div>
  );
}
