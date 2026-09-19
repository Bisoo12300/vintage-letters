'use client';

import { useEffect } from 'react';

export function PlanModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="animate-overlay-in absolute inset-0 bg-mora-brown-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-sheet-up relative z-10 flex max-h-[90vh] w-full max-w-md flex-col rounded-t-[1.75rem] border border-mora-beige-200 bg-white shadow-soft-lg sm:animate-fade-in-up sm:rounded-2xl"
      >
        <div className="flex justify-center pb-1 pt-2.5 sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-mora-beige-200" />
        </div>
        <div className="flex items-center justify-between border-b border-mora-beige-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-mora-brown-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-full px-3 font-body text-sm text-mora-brown-500 transition hover:bg-mora-beige-50 active:scale-90"
          >
            Close
          </button>
        </div>
        <div
          className="overflow-y-auto px-5 py-4"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
