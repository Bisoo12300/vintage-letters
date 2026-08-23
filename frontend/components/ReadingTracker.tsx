'use client';

import { useEffect, useRef } from 'react';
import { API_URL, apiFetch } from '@/lib/api';

export function useReadingTracker(letterId: string) {
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const startingRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!letterId) return;
    let active = true;

    async function startSession() {
      const task = (async () => {
        const data = await apiFetch<{ sessionId: string }>(
          `/letters/${letterId}/read-start`,
          { method: 'POST' }
        );
        if (active) {
          sessionIdRef.current = data.sessionId;
          startTimeRef.current = Date.now();
        }
      })();
      startingRef.current = task;
      try {
        await task;
      } catch {
        /* tracking is best-effort */
      } finally {
        if (startingRef.current === task) startingRef.current = null;
      }
    }

    void startSession();

    function endSession() {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      sessionIdRef.current = null;

      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - startTimeRef.current) / 1000)
      );
      const body = JSON.stringify({ sessionId, durationSeconds });

      // ponytail: sendBeacon fails cross-origin with JSON (no CORS preflight) — use fetch+keepalive
      fetch(`${API_URL}/letters/${letterId}/read-end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
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
      const pending = startingRef.current;
      if (pending) {
        void pending.finally(endSession);
      } else {
        endSession();
      }
    };
  }, [letterId]);
}
