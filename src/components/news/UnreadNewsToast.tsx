'use client';

import { useEffect } from 'react';
import { toastWarning } from '@/components/ui/Toast';

/** After login, show once if sessionStorage has unread news count */
export function UnreadNewsToast() {
  useEffect(() => {
    try {
      const n = sessionStorage.getItem('bi-unread-news');
      if (n && Number(n) > 0) {
        toastWarning(
          'Okalmadyk habarlar',
          `Siziň ${n} sany okalmadyk habaryňyz bar. Habarlar bölümine geçiň.`
        );
        sessionStorage.removeItem('bi-unread-news');
      }
    } catch {
      /* */
    }
  }, []);
  return null;
}
