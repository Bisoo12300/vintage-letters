'use client';

import { useEffect, useRef, useState } from 'react';

const DISMISS_PX = 110;
const DISMISS_VELOCITY = 0.6;

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
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ startY: 0, lastY: 0, lastT: 0, velocity: 0 });

  useEffect(() => {
    if (!open) return;
    setDragY(0);
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

  // Drag-down-to-dismiss from the grabber / header (sheet presentation on phones)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dy = e.clientY - drag.current.startY;
    setDragY(dy > 0 ? dy : dy * 0.2);
    const dt = e.timeStamp - drag.current.lastT;
    if (dt > 0) drag.current.velocity = (e.clientY - drag.current.lastY) / dt;
    drag.current.lastY = e.clientY;
    drag.current.lastT = e.timeStamp;
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragY > DISMISS_PX || drag.current.velocity > DISMISS_VELOCITY) onClose();
    else setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="animate-overlay-in absolute inset-0 bg-ink-900/30 backdrop-blur-[3px]"
        style={{ opacity: Math.max(0.3, 1 - dragY / 400) }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-up relative z-10 w-full max-w-md"
      >
        <div
          className="glass-thick flex max-h-[90vh] flex-col rounded-t-[2rem] sm:rounded-[2rem]"
          style={{
            transform: dragY ? `translateY(${dragY}px)` : undefined,
            transition: dragging ? 'none' : 'transform 0.5s var(--spring)',
          }}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="touch-none select-none"
          >
            <div className="flex justify-center pb-1 pt-2.5 sm:hidden">
              <span className="h-[5px] w-9 rounded-full bg-ink-800/20" />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-2 sm:pt-5">
              <h2 className="font-display text-2xl font-semibold text-ink-800">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-800/[0.07] text-ink-500 transition-transform duration-300 ease-spring hover:bg-ink-800/10 active:scale-90"
              >
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <div
            className="overflow-y-auto px-5 pb-5"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
