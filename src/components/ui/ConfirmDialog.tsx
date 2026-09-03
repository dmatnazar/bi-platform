'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { useModalAnimations } from '@/lib/use-modal-animations';

type ConfirmResult = boolean | 'stay';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Optional third button (e.g. "Ýatda sakla" stay) — resolves to 'stay' */
  stayLabel: string | null;
  danger: boolean;
  resolve: ((ok: ConfirmResult) => void) | null;
  show: (o: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    stayLabel?: string;
    danger?: boolean;
  }) => Promise<ConfirmResult>;
  close: (ok: ConfirmResult) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Hawa',
  cancelLabel: 'Ýatyr',
  stayLabel: null,
  danger: false,
  resolve: null,
  show: ({ title, message, confirmLabel, cancelLabel, stayLabel, danger }) =>
    new Promise<ConfirmResult>((resolve) => {
      const prev = get().resolve;
      if (prev) prev(false);
      set({
        open: true,
        title,
        message,
        confirmLabel: confirmLabel || 'Hawa',
        cancelLabel: cancelLabel || 'Ýatyr',
        stayLabel: stayLabel || null,
        danger: danger ?? true,
        resolve,
      });
    }),
  close: (ok) => {
    const r = get().resolve;
    set({ open: false, resolve: null, stayLabel: null });
    r?.(ok);
  },
}));

export function confirmDialog(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  stayLabel?: string;
  danger?: boolean;
}) {
  return useConfirmStore.getState().show(opts);
}

export function ConfirmDialogHost() {
  const { open, title, message, confirmLabel, cancelLabel, stayLabel, danger, close } =
    useConfirmStore();
  const [mounted, setMounted] = useState(false);
  const animOn = useModalAnimations();
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[2147482900] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className="absolute inset-0 bg-slate-950/80"
        onClick={() => close(stayLabel ? 'stay' : false)}
      />
      <div
        className={
          'relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl space-y-4' +
          (animOn ? ' animate-in fade-in zoom-in-95 duration-150' : '')
        }
      >
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
        <div className="flex flex-wrap justify-end gap-2">
          {stayLabel && (
            <Button variant="secondary" size="sm" onClick={() => close('stay')}>
              {stayLabel}
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => close(false)}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={() => close(true)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
