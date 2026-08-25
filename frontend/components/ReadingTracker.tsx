'use client';

import { useEffect, useRef } from 'react';
import { API_URL, apiFetch } from '@/lib/api';
import { readStoredIdentity } from '@/lib/identity';

export function useReadingTracker(letterId: string) {
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const startingRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!letterId) return;
    let active = true;
    const author = readStoredIdentity();
    if (!author) return;

    async function startSession() {
      const task = (async () => {
        const data = await apiFetch<{ sessionId: string }>(
          `/letters/${letterId}/read-start`,
          { method: 'POST', author }
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (author) headers['x-author'] = author;

      fetch(`${API_URL}/letters/${letterId}/read-end?author=${author}`, {
        method: 'POST',
        headers,
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
