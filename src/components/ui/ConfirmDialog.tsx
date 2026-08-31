'use client';

import { create } from 'zustand';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: ((ok: boolean) => void) | null;
  show: (o: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  close: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Hawa',
  danger: false,
  resolve: null,
  show: ({ title, message, confirmLabel, danger }) =>
    new Promise<boolean>((resolve) => {
      const prev = get().resolve;
      if (prev) prev(false);
      set({
        open: true,
        title,
        message,
        confirmLabel: confirmLabel || 'Hawa',
        danger: danger ?? true,
        resolve,
      });
    }),
  close: (ok) => {
    const r = get().resolve;
    set({ open: false, resolve: null });
    r?.(ok);
  },
}));

export function confirmDialog(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return useConfirmStore.getState().show(opts);
}

export function ConfirmDialogHost() {
  const { open, title, message, confirmLabel, danger, close } = useConfirmStore();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2147482900] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-950/80" onClick={() => close(false)} />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-5 border-slate-700 shadow-2xl space-y-4">
        <div className="flex gap-3">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              danger ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => close(false)}>
            Ýatyr
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={() => close(true)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
