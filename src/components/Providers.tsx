'use client';

import { ToastHost } from '@/components/ui/Toast';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';
import { SessionWatcher } from '@/components/auth/SessionWatcher';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastHost />
      <ConfirmDialogHost />
      <SessionWatcher />
    </>
  );
}
