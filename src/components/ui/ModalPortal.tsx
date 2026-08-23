'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ParticlesBackground } from '@/components/ParticlesBackground';

/**
 * Renders modal content on document.body so sticky navbar / sidebar
 * stacking contexts cannot cover it. Particles like login page.
 */
export function ModalPortal({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[290] pointer-events-none opacity-40">
        <ParticlesBackground />
      </div>
      {children}
    </>,
    document.body
  );
}
