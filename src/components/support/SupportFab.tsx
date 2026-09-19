'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, GripHorizontal, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { SupportChat } from '@/components/support/SupportChat';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';

const STORAGE_KEY = 'bi-support-fab-pos';
const PANEL_POS_KEY = 'bi-support-panel-pos';

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* */
  }
}

/**
 * FAB + süýşürilýän goldaw card (widget sazlama ýaly).
 * Ticket sanawy açylanda panel giňelýär.
 */
export function SupportFab() {
  const { t } = useLocale();

  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const start = useRef({ px: 0, py: 0, ox: 0, oy: 0 });
  const panelDrag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const size = isMobile ? 46 : 56;

  function clampFab(x: number, y: number) {
    if (typeof window === 'undefined') return { x, y };
    return {
      x: Math.min(Math.max(8, window.innerWidth - size - 8), Math.max(8, x)),
      y: Math.min(Math.max(8, window.innerHeight - size - 8), Math.max(8, y)),
    };
  }

  function panelSize() {
    if (typeof window === 'undefined') return { w: 420, h: 560 };
    if (isMobile) {
      return { w: window.innerWidth, h: Math.min(window.innerHeight * 0.88, 720) };
    }
    const w = listOpen
      ? Math.min(760, window.innerWidth - 24)
      : Math.min(440, window.innerWidth - 24);
    const h = Math.min(640, window.innerHeight - 32);
    return { w, h };
  }

  function clampPanel(x: number, y: number) {
    if (typeof window === 'undefined') return { x, y };
    const { w, h } = panelSize();
    return {
      x: Math.min(Math.max(8, window.innerWidth - w - 8), Math.max(8, x)),
      y: Math.min(Math.max(8, window.innerHeight - h - 8), Math.max(8, y)),
    };
  }

  useEffect(() => {
    const saved = loadJson<{ x: number; y: number }>(STORAGE_KEY);
    if (saved) setPos(clampFab(saved.x, saved.y));
    else if (typeof window !== 'undefined') {
      setPos(clampFab(window.innerWidth - size - 20, window.innerHeight - size - 20));
    }
    const pp = loadJson<{ x: number; y: number }>(PANEL_POS_KEY);
    if (pp) setPanelPos(pp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onResize() {
      setPos((p) => (p ? clampFab(p.x, p.y) : p));
      setPanelPos((p) => (p ? clampPanel(p.x, p.y) : p));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, listOpen, isMobile]);

  // Giňelen panel ekrandan çykmasyn
  useEffect(() => {
    setPanelPos((p) => {
      if (!p || typeof window === 'undefined') return p;
      return clampPanel(p.x, p.y);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpen]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cancelled) return;
      try {
        const res = await fetch('/api/support/unread');
        if (res.status === 401) {
          cancelled = true;
          return;
        }
        const data = await res.json();
        if (!cancelled && res.ok) {
          setCount(data.count || 0);
          setIsAdmin(!!data.isAdmin);
        }
      } catch {
        /* */
      }
    }
    void load();
    const id = setInterval(load, 20000);
    const onOut = () => {
      cancelled = true;
      clearInterval(id);
    };
    window.addEventListener('bi-logged-out', onOut);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('bi-logged-out', onOut);
    };
  }, [pathname, open]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!pos) return;
      dragging.current = true;
      moved.current = false;
      start.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [pos]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - start.current.px;
      const dy = e.clientY - start.current.py;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
      setPos(clampFab(start.current.ox + dx, start.current.oy + dy));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size]
  );

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setPos((p) => {
      if (!p) return p;
      const c = clampFab(p.x, p.y);
      saveJson(STORAGE_KEY, c);
      return c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  function onPanelHeaderDown(e: React.PointerEvent) {
    if (isMobile) return;
    const t = e.target as HTMLElement;
    if (t.closest('button')) return;
    const base =
      panelPos ||
      (typeof window !== 'undefined'
        ? { x: window.innerWidth - panelSize().w - 16, y: window.innerHeight - panelSize().h - 16 }
        : { x: 16, y: 16 });
    panelDrag.current = { px: e.clientX, py: e.clientY, ox: base.x, oy: base.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPanelHeaderMove(e: React.PointerEvent) {
    if (!panelDrag.current) return;
    const dx = e.clientX - panelDrag.current.px;
    const dy = e.clientY - panelDrag.current.py;
    setPanelPos(clampPanel(panelDrag.current.ox + dx, panelDrag.current.oy + dy));
  }

  function onPanelHeaderUp() {
    if (!panelDrag.current) return;
    panelDrag.current = null;
    setPanelPos((p) => {
      if (!p) return p;
      const c = clampPanel(p.x, p.y);
      saveJson(PANEL_POS_KEY, c);
      return c;
    });
  }

  if (pathname?.startsWith('/support') || pathname?.startsWith('/admin/support')) {
    return null;
  }

  if (!pos) return null;

  const { w: panelW, h: panelH } = panelSize();
  const resolvedPanel =
    panelPos ||
    (typeof window !== 'undefined'
      ? clampPanel(window.innerWidth - panelW - 16, window.innerHeight - panelH - 16)
      : { x: 16, y: 16 });

  const panel =
    mounted && typeof document !== 'undefined'
      ? createPortal(
          <div className={cn('fixed inset-0 z-[90]', open ? 'pointer-events-none' : 'hidden')}>
            {open && (
              <div
                className="absolute inset-0 bg-black/30 pointer-events-auto sm:bg-black/20"
                onClick={() => setOpen(false)}
              />
            )}
            <div
              className={cn(
                'pointer-events-auto absolute flex flex-col overflow-hidden',
                'bg-slate-950 border border-slate-700/80 shadow-2xl shadow-black/50',
                isMobile ? 'rounded-t-2xl' : 'rounded-2xl',
                'transition-[width] duration-200'
              )}
              style={
                isMobile
                  ? {
                      left: 0,
                      right: 0,
                      bottom: 0,
                      width: '100%',
                      height: panelH,
                    }
                  : {
                      left: resolvedPanel.x,
                      top: resolvedPanel.y,
                      width: panelW,
                      height: panelH,
                    }
              }
            >
              {/* Drag handle header */}
              <div
                className={cn(
                  'shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 bg-slate-900/95',
                  !isMobile && 'cursor-grab active:cursor-grabbing select-none'
                )}
                onPointerDown={onPanelHeaderDown}
                onPointerMove={onPanelHeaderMove}
                onPointerUp={onPanelHeaderUp}
                onPointerCancel={onPanelHeaderUp}
              >
                {!isMobile && <GripHorizontal className="h-4 w-4 text-slate-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">Goldaw</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {isAdmin ? 'Admin ticketler' : t('techSupport')}
                    {!isMobile && t('draggableHint')}
                  </p>
                </div>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                  title={listOpen ? t('collapseList') : t('expandList')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setListOpen((v) => !v);
                  }}
                >
                  {listOpen ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeftOpen className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 p-2 sm:p-2.5 overflow-hidden">
                <SupportChat
                  mode={isAdmin ? 'admin' : 'user'}
                  embedded
                  listOpen={listOpen}
                  onListOpenChange={setListOpen}
                />
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        className="fixed z-[80] touch-none select-none"
        style={{ left: pos.x, top: pos.y, width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          type="button"
          onClick={() => {
            if (moved.current) {
              moved.current = false;
              return;
            }
            setOpen((v) => {
              const next = !v;
              if (next) setMounted(true);
              return next;
            });
          }}
          style={{ width: size, height: size }}
          className={cn(
            'bi-support-fab flex cursor-grab active:cursor-grabbing items-center justify-center rounded-2xl',
            'bg-indigo-600/45 text-white/90 shadow-lg shadow-indigo-900/20',
            'hover:bg-indigo-600/70 hover:text-white backdrop-blur-sm border border-indigo-400/20',
            'transition-colors relative',
            open && 'ring-2 ring-indigo-400/50 bg-indigo-600/80'
          )}
          title="Goldaw"
        >
          <MessageCircle className={isMobile ? 'h-5 w-5 pointer-events-none' : 'h-6 w-6 pointer-events-none'} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 sm:h-5 sm:min-w-5 px-1 rounded-full bg-rose-500 text-[9px] sm:text-[10px] font-bold flex items-center justify-center border-2 border-slate-950 pointer-events-none">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      </div>
      {panel}
    </>
  );
}
