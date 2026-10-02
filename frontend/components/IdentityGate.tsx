'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AUTHORS,
  clearStoredIdentity,
  readStoredIdentity,
  writeStoredIdentity,
  type AuthorId,
} from '@/lib/identity';
import { AuthorGlyph, LogoMark, OrbitLoader } from '@/components/brand';
import { ensurePushSubscription } from '@/lib/push';

const IdentityContext = createContext<{
  identity: AuthorId | null;
  setIdentity: (id: AuthorId) => void;
  switchIdentity: () => void;
}>({
  identity: null,
  setIdentity: () => {},
  switchIdentity: () => {},
});

export function useIdentity() {
  return useContext(IdentityContext);
}

const ENTER_MS = 520;

export function IdentityGate({ children }: { children: React.ReactNode }) {
  const [identity, setIdentityState] = useState<AuthorId | null>(null);
  const [ready, setReady] = useState(false);
  const [entering, setEntering] = useState<AuthorId | null>(null);

  useEffect(() => {
    const stored = readStoredIdentity();
    setIdentityState(stored);
    setReady(true);
    if (stored) ensurePushSubscription(stored);
  }, []);

  // The sky tint follows whoever is signed in (or being picked).
  useEffect(() => {
    const tint = entering ?? identity;
    if (tint) document.documentElement.dataset.identity = tint;
    else delete document.documentElement.dataset.identity;
  }, [identity, entering]);

  const value = useMemo(
    () => ({
      identity,
      setIdentity: (id: AuthorId) => {
        writeStoredIdentity(id);
        setIdentityState(id);
        ensurePushSubscription(id);
      },
      switchIdentity: () => {
        clearStoredIdentity();
        setIdentityState(null);
      },
    }),
    [identity]
  );

  function pick(id: AuthorId) {
    if (entering) return;
    setEntering(id);
    setTimeout(() => {
      value.setIdentity(id);
      setEntering(null);
    }, ENTER_MS);
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <OrbitLoader />
      </div>
    );
  }

  return (
    <IdentityContext.Provider value={value}>
      {!identity ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-6 transition-opacity duration-500 ease-ios"
          style={{ opacity: entering ? 0 : 1 }}
        >
          <div className="animate-fade-in-up flex flex-col items-center text-center">
            <LogoMark className="h-16 w-16 drop-shadow-[0_8px_20px_rgba(35,40,88,0.25)]" />
            <h1 className="mt-6 font-display text-5xl font-semibold italic tracking-[-0.02em] text-ink-800 sm:text-6xl">
              Clair de Lune
            </h1>
            <p className="mt-3 max-w-xs font-body text-[17px] leading-snug text-ink-500">
              Who's writing tonight? Tap your side of the sky.
            </p>
          </div>

          <div className="mt-12 flex items-center gap-6 sm:gap-10">
            {AUTHORS.map((author, i) => {
              const chosen = entering === author.id;
              const dimmed = entering && !chosen;
              return (
                <button
                  key={author.id}
                  type="button"
                  onClick={() => pick(author.id)}
                  className="animate-fade-in-up group flex flex-col items-center gap-4"
                  style={{ animationDelay: `${0.12 + i * 0.08}s` }}
                >
                  <span
                    className="glass flex h-32 w-32 items-center justify-center rounded-full transition-transform duration-500 ease-spring group-hover:scale-105 group-active:scale-95 sm:h-40 sm:w-40"
                    style={{
                      transform: chosen ? 'scale(1.18)' : dimmed ? 'scale(0.85)' : undefined,
                      opacity: dimmed ? 0.4 : 1,
                    }}
                  >
                    <AuthorGlyph author={author.id} className="h-16 w-16 sm:h-20 sm:w-20" />
                  </span>
                  <span className="font-display text-2xl font-semibold text-ink-800">{author.label}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-10 font-body text-[13px] text-ink-400">You can switch anytime from the top bar.</p>
        </div>
      ) : (
        children
      )}
    </IdentityContext.Provider>
  );
}
