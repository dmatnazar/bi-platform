'use client';

import { create } from 'zustand';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastState {
  items: ToastItem[];
  push: (o: { title: string; message?: string; variant?: ToastVariant; durationMs?: number }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: ({ title, message, variant = 'info', durationMs = 5000 }) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ items: [...s.items, { id, title, message, variant, durationMs }].slice(-6) }));
    if (durationMs > 0) setTimeout(() => get().dismiss(id), durationMs);
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function toast(opts: { title: string; message?: string; variant?: ToastVariant; durationMs?: number }) {
  return useToastStore.getState().push(opts);
}
export function toastSuccess(title: string, message?: string) {
  return toast({ title, message, variant: 'success' });
}
export function toastWarning(title: string, message?: string) {
  return toast({ title, message, variant: 'warning', durationMs: 7000 });
}
export function toastError(title: string, message?: string) {
  return toast({ title, message, variant: 'error', durationMs: 8000 });
}
export function toastInfo(title: string, message?: string) {
  return toast({ title, message, variant: 'info' });
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
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[min(420px,calc(100vw-1.5rem))] pointer-events-none items-stretch">
      {items.map((t) => {
        const st = STYLES[t.variant];
        const Icon = st.Icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border ${st.border} ${st.bg} backdrop-blur-md shadow-xl px-3.5 py-3 flex gap-3`}
          >
            <Icon className={`h-4.5 w-4.5 ${st.ic} shrink-0 mt-0.5`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{t.title}</p>
              {t.message && <p className="text-xs text-slate-400 mt-0.5 whitespace-pre-wrap">{t.message}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
