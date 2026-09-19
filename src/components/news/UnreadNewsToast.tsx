'use client';

import { useEffect } from 'react';
import { toastWarning } from '@/components/ui/Toast';
import { useLocale } from '@/components/LocaleProvider';

/** After login, show once if sessionStorage has unread news count */
export function UnreadNewsToast() {
  const { t } = useLocale();

  useEffect(() => {
    try {
      const n = sessionStorage.getItem('bi-unread-news');
      if (n && Number(n) > 0) {
        toastWarning(
          t('unreadNews'),
          `Siziň ${n} sany okalmadyk habaryňyz bar. Habarlar bölümine geçiň.`,
          '/news'
        );
        sessionStorage.removeItem('bi-unread-news');
      }
    } catch {
      /* */
    }
  }, []);
  return null;
}
