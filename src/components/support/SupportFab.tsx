'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

const STORAGE_KEY = 'bi-support-fab-pos';

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.x === 'number' && typeof p.y === 'number') return p;
  } catch {
    /* */
  }
  return null;
}

function savePos(x: number, y: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
  } catch {
    /* */
  }
}

export function SupportFab() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const start = useRef({ px: 0, py: 0, ox: 0, oy: 0 });
  const size = 56;

  useEffect(() => {
    const saved = loadPos();
    if (saved) {
      setPos(clamp(saved.x, saved.y));
    } else {
      // default bottom-right
      setPos(
        clamp(
          typeof window !== 'undefined' ? window.innerWidth - size - 20 : 20,
          typeof window !== 'undefined' ? window.innerHeight - size - 20 : 20
        )
      );
    }
  }, []);

  useEffect(() => {
    function onResize() {
      setPos((p) => (p ? clamp(p.x, p.y) : p));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function clamp(x: number, y: number) {
    if (typeof window === 'undefined') return { x, y };
    const maxX = Math.max(8, window.innerWidth - size - 8);
    const maxY = Math.max(8, window.innerHeight - size - 8);
    return {
      x: Math.min(maxX, Math.max(8, x)),
      y: Math.min(maxY, Math.max(8, y)),
    };
  }

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

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!pos) return;
    dragging.current = true;
    moved.current = false;
    start.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.px;
    const dy = e.clientY - start.current.py;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
    const next = clamp(start.current.ox + dx, start.current.oy + dy);
    setPos(next);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    setPos((p) => {
      if (!p) return p;
      const c = clamp(p.x, p.y);
      savePos(c.x, c.y);
      return c;
    });
    if (moved.current) {
      // prevent navigation after drag
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  if (pathname?.startsWith('/support') || pathname?.startsWith('/admin/support')) {
    return null;
  }

  const href = isAdmin ? '/admin/support' : '/support';

  if (!pos) return null;

  return (
    <div
      className="fixed z-[100] touch-none select-none"
      style={{ left: pos.x, top: pos.y, width: size, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Link
        href={href}
        draggable={false}
        onClick={(e) => {
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
        className="flex h-14 w-14 cursor-grab active:cursor-grabbing items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 transition-colors relative"
        title="Goldaw — süýşürip bolýar"
      >
        <MessageCircle className="h-6 w-6 pointer-events-none" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-rose-500 text-[10px] font-bold flex items-center justify-center border-2 border-slate-950 pointer-events-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Link>
    </div>
  );
}
