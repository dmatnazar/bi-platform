'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ParticlesBackground } from '@/components/ParticlesBackground';
import { useModalAnimations } from '@/lib/use-modal-animations';

/**
 * Renders modal content on document.body so sticky navbar / sidebar
 * stacking contexts cannot cover it. Particles like login page — but only
 * when the "Modallar" animation setting is on.
 */
export function ModalPortal({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const animOn = useModalAnimations();
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  return createPortal(
    <>
      {animOn && (
        <div className="fixed inset-0 z-[2147482800] pointer-events-none opacity-40">
          <ParticlesBackground />
        </div>
      )}
      {children}
    </>,
    document.body
  );
}
