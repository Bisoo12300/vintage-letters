export const IDENTITY_KEY = 'clair-identity';

export const AUTHORS = [
  { id: 'moon', label: 'Moon', emoji: '🌙' },
  { id: 'sun', label: 'Sun', emoji: '☀️' },
] as const;

export type AuthorId = (typeof AUTHORS)[number]['id'];

export function isAuthorId(value: string | null | undefined): value is AuthorId {
  return value === 'moon' || value === 'sun';
}

export function authorLabel(id: string | undefined) {
  return AUTHORS.find((a) => a.id === id)?.label ?? 'Unknown';
}

export function authorEmoji(id: string | undefined) {
  return AUTHORS.find((a) => a.id === id)?.emoji ?? '✉';
}

export function readStoredIdentity(): AuthorId | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(IDENTITY_KEY);
  return isAuthorId(raw) ? raw : null;
}

export function writeStoredIdentity(id: AuthorId) {
  localStorage.setItem(IDENTITY_KEY, id);
}

export function clearStoredIdentity() {
  localStorage.removeItem(IDENTITY_KEY);
}
