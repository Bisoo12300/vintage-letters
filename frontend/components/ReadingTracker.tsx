'use client';

import { useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';

export function useReadingTracker(letterId: string) {
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!letterId) return;
    let active = true;

    async function startSession() {
      try {
        const data = await apiFetch<{ sessionId: string }>(
          `/letters/${letterId}/read-start`,
          { method: 'POST' }
        );
        if (active) {
          sessionIdRef.current = data.sessionId;
          startTimeRef.current = Date.now();
        }
      } catch {
        /* tracking is best-effort */
      }
    }

    startSession();

    function endSession() {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      sessionIdRef.current = null;

      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      const body = JSON.stringify({ sessionId, durationSeconds });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/letters/${letterId}/read-end`,
          new Blob([body], { type: 'application/json' })
        );
      } else {
        apiFetch(`/letters/${letterId}/read-end`, {
          method: 'POST',
          body,
          keepalive: true,
        }).catch(() => {});
      }
    }

    const onHide = () => {
      if (document.visibilityState === 'hidden') endSession();
    };

    window.addEventListener('pagehide', endSession);
    document.addEventListener('visibilitychange', onHide);

    return () => {
      active = false;
      window.removeEventListener('pagehide', endSession);
      document.removeEventListener('visibilitychange', onHide);
      endSession();
    };
  }, [letterId]);
}
