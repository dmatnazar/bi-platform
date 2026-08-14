'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

export function SupportFab() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/support/unread');
        const data = await res.json();
        if (!cancelled && res.ok) {
          setCount(data.count || 0);
          setIsAdmin(!!data.isAdmin);
        }
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  if (pathname?.startsWith('/support') || pathname?.startsWith('/admin/support')) {
    return null;
  }

  const href = isAdmin ? '/admin/support' : '/support';

  return (
    <Link
      href={href}
      className="fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 transition-colors"
      title="Goldaw"
      style={{ position: 'fixed', bottom: '1.25rem', right: '1.25rem' }}
    >
      <MessageCircle className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-rose-500 text-[10px] font-bold flex items-center justify-center border-2 border-slate-950">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
