'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AUTHORS,
  clearStoredIdentity,
  readStoredIdentity,
  writeStoredIdentity,
  type AuthorId,
} from '@/lib/identity';
import { BookLoader } from '@/components/BookLoader';
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

export function IdentityGate({ children }: { children: React.ReactNode }) {
  const [identity, setIdentityState] = useState<AuthorId | null>(null);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<AuthorId>('moon');

  useEffect(() => {
    const stored = readStoredIdentity();
    setIdentityState(stored);
    setReady(true);
    if (stored) ensurePushSubscription(stored);
  }, []);

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

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mora-cream">
        <BookLoader />
      </div>
    );
  }

  return (
    <IdentityContext.Provider value={value}>
      {!identity ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-mora-cream px-5">
          <form
            className="mora-card animate-fade-in-up w-full max-w-md text-center"
            onSubmit={(e) => {
              e.preventDefault();
              value.setIdentity(picked);
            }}
          >
            <p className="font-body text-sm tracking-widest text-mora-brown-500 uppercase">Clair de Lune</p>
            <h1 className="font-display mt-2 text-3xl font-semibold text-mora-brown-800">Who are you?</h1>
            <p className="font-body mt-3 text-mora-brown-500">
              Choose Moon or Sun. You can switch anytime from the header.
            </p>

            <fieldset className="mt-8 space-y-3 text-left">
              {AUTHORS.map((author) => (
                <label
                  key={author.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-4 transition ${
                    picked === author.id
                      ? 'border-mora-brown-500 bg-mora-beige-50 shadow-soft'
                      : 'border-mora-beige-200 bg-white hover:border-mora-brown-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="identity"
                    value={author.id}
                    checked={picked === author.id}
                    onChange={() => setPicked(author.id)}
                    className="h-4 w-4 accent-mora-brown-600"
                  />
                  <span className="text-2xl" aria-hidden>
                    {author.emoji}
                  </span>
                  <span className="font-display text-lg text-mora-brown-800">{author.label}</span>
                </label>
              ))}
            </fieldset>

            <button type="submit" className="mora-btn-primary mt-8 w-full">
              Enter
            </button>
          </form>
        </div>
      ) : (
        children
      )}
    </IdentityContext.Provider>
  );
}
