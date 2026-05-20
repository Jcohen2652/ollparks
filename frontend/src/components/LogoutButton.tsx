'use client';

import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const supabase = getBrowserClient();
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }}
      className="w-full mt-1 px-3 py-2 rounded-lg text-sm text-left text-slate-700 hover:bg-slate-100"
    >
      ↩️ Déconnexion
    </button>
  );
}
