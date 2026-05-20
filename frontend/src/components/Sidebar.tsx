import Link from 'next/link';
import { LogoutButton } from './LogoutButton';
import { getServerClient } from '@/lib/supabase/server';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/entreprises', label: 'Entreprises', icon: '🏢' },
  { href: '/contacts', label: 'Contacts', icon: '👤' },
  { href: '/biens', label: 'Biens', icon: '🏬' },
  { href: '/biens/carte', label: 'Carte', icon: '🗺️' },
  { href: '/besoins', label: 'Besoins', icon: '🔍' },
  { href: '/matching', label: 'Matching', icon: '🎯' },
  { href: '/visites', label: 'Visites', icon: '📅' },
  { href: '/documents', label: 'Documents', icon: '📄' },
  { href: '/outlook', label: 'Outlook', icon: '✉️' },
  { href: '/proprietaires', label: 'Propriétaires', icon: '🔑' },
  { href: '/agenda', label: 'Agenda', icon: '🗓️' },
  { href: '/pipeline', label: 'Pipeline', icon: '📈' },
  { href: '/integrations', label: 'Intégrations', icon: '🔌' },
];

export async function Sidebar() {
  const sb = await getServerClient();
  const { data: { user } } = await sb.auth.getUser();

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white px-4 py-6 min-h-screen flex flex-col">
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-900 to-blue-700 flex items-center justify-center text-white font-bold">
          O
        </div>
        <span className="font-bold text-lg">OLL PARKS</span>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      {user && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="px-3 py-2 text-xs text-slate-500 truncate" title={user.email ?? ''}>
            {user.email}
          </div>
          <LogoutButton />
        </div>
      )}
    </aside>
  );
}
