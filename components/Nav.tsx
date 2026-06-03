'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Today', desc: 'Daily briefing' },
  { href: '/upload', label: 'Upload', desc: 'Import customers' },
  { href: '/profiles', label: 'Profiles', desc: 'Review & validate' },
  { href: '/overview', label: 'Overview', desc: 'All accounts' },
  { href: '/integrations', label: 'Integrations', desc: 'Phase 2' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">L</span>
          </div>
          <span className="font-semibold text-white text-sm tracking-tight">Light Health</span>
        </div>

        <nav className="flex items-center gap-1">
          {links.map(link => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-500 bg-opacity-20 text-blue-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                {link.label}
                {link.href === '/integrations' && (
                  <span className="ml-1.5 text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">soon</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
