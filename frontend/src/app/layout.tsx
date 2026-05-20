import type { Metadata } from 'next';
import { Sidebar } from '@/components/Sidebar';
import { getServerClient } from '@/lib/supabase/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'OLL PARKS — Console',
  description: 'Plateforme immobilière B2B',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sb = await getServerClient();
  const { data: { user } } = await sb.auth.getUser();

  return (
    <html lang="fr">
      <body>
        {user ? (
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-8">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
