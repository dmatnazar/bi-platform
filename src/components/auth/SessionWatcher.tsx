'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AlertTriangle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function SessionWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [invalidMsg, setInvalidMsg] = useState<string | null>(null);
  const checkingRef = useRef(false);

  const isPublicPage = pathname === '/login' || pathname === '/register';

  useEffect(() => {
    if (isPublicPage) return;

    async function checkSession() {
      if (checkingRef.current || document.hidden) return;
      checkingRef.current = true;
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg =
            data.error ||
            'Hasabyňyzda üýtgeşme boldy (işjeňlik, parol ýa-da maglumatlar). Täzeden giriň.';
          setInvalidMsg(msg);
        }
      } catch {
        /* ignore network hiccups */
      } finally {
        checkingRef.current = false;
      }
    }

    // Check on interval (every 20s)
    const interval = setInterval(checkSession, 20_000);

    // Also check on tab focus
    const onFocus = () => checkSession();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [isPublicPage]);

  function handleGoLogin() {
    setInvalidMsg(null);
    router.push('/login');
    router.refresh();
  }

  if (!invalidMsg) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3 text-amber-400">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Sessiýa bes edildi</h3>
            <p className="text-xs text-amber-300/80">Hasap maglumatlary täzelendi</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
          {invalidMsg}
        </p>

        <Button
          onClick={handleGoLogin}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium"
          size="lg"
        >
          <LogIn className="h-4 w-4 mr-2" />
          Täzeden girmek (Login)
        </Button>
      </div>
    </div>
  );
}
