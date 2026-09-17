'use client';

import { create } from 'zustand';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  durationMs: number;
  href?: string;
};

type ToastState = {
  items: ToastItem[];
  push: (item: Omit<ToastItem, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (opts) => {
    const id = opts.id || `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: ToastItem = {
      id,
      title: opts.title,
      message: opts.message,
      variant: opts.variant,
      durationMs: opts.durationMs ?? 4500,
      href: opts.href,
    };
    set({ items: [...get().items, item] });
    if (item.durationMs > 0) {
      window.setTimeout(() => {
        get().dismiss(id);
      }, item.durationMs);
    }
    return id;
  },
  dismiss: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
}));

export function toast(opts: {
  title: string;
  message?: string;
  variant?: ToastVariant;
  durationMs?: number;
  href?: string;
}) {
  return useToastStore.getState().push({
    title: opts.title,
    message: opts.message,
    variant: opts.variant || 'info',
    durationMs: opts.durationMs ?? 4500,
    href: opts.href,
  });
}
export function toastSuccess(title: string, message?: string, href?: string) {
  return toast({ title, message, variant: 'success', href });
}
export function toastWarning(title: string, message?: string, href?: string) {
  return toast({ title, message, variant: 'warning', durationMs: 7000, href });
}
export function toastError(title: string, message?: string, href?: string) {
  return toast({ title, message, variant: 'error', durationMs: 8000, href });
}
export function toastInfo(title: string, message?: string, href?: string) {
  return toast({ title, message, variant: 'info', href });
}

const STYLES = {
  success: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', Icon: CheckCircle2, ic: 'text-emerald-400' },
  warning: { border: 'border-amber-500/40', bg: 'bg-amber-500/10', Icon: AlertTriangle, ic: 'text-amber-400' },
  error: { border: 'border-rose-500/40', bg: 'bg-rose-500/10', Icon: XCircle, ic: 'text-rose-400' },
  info: { border: 'border-sky-500/40', bg: 'bg-sky-500/10', Icon: Info, ic: 'text-sky-400' },
};

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || items.length === 0) return null;

  return createPortal(
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[min(420px,calc(100vw-1.5rem))] pointer-events-none items-stretch"
      style={{ zIndex: 2147483646 }}
    >
      {items.map((t) => {
        const st = STYLES[t.variant];
        const Icon = st.Icon;
        const go = () => {
          if (t.href) {
            dismiss(t.id);
            window.location.href = t.href;
          }
        };
        return (
          <div
            key={t.id}
            role={t.href ? 'link' : undefined}
            onClick={t.href ? go : undefined}
            className={`pointer-events-auto rounded-xl border ${st.border} ${st.bg} bg-slate-950/98 backdrop-blur-md shadow-2xl px-3.5 py-3 flex gap-3 ${
              t.href ? 'cursor-pointer hover:ring-1 hover:ring-white/20' : ''
            }`}
          >
            <Icon className={`h-4.5 w-4.5 ${st.ic} shrink-0 mt-0.5`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{t.title}</p>
              {t.message && (
                <p className="text-xs text-slate-300 mt-0.5 whitespace-pre-wrap break-words">{t.message}</p>
              )}
              {t.href && (
                <p className="text-[10px] text-indigo-300 mt-1">Basyp git →</p>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(t.id);
              }}
              className="text-slate-500 hover:text-white shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
