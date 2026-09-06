'use client';

import { UnreadNewsToast } from '@/components/news/UnreadNewsToast';
import { ToastHost } from '@/components/ui/Toast';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UnreadNewsToast />
      {children}
      <ToastHost />
      <ConfirmDialogHost />
    </>
  );
}
