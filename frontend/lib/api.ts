import { readStoredIdentity, type AuthorId } from '@/lib/identity';

function normalizeApiUrl(raw: string): string {
  let url = raw.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (!url.endsWith('/api')) url = `${url.replace(/\/api$/, '')}/api`;
  return url;
}

const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api');

export { API_URL };

export async function apiFetch<T>(
  path: string,
  options: RequestInit & {
    adminPassword?: string;
    readerToken?: string;
    author?: AuthorId | null;
  } = {}
): Promise<T> {
  const { adminPassword, readerToken, author: authorOpt, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  const author = authorOpt ?? readStoredIdentity();
  if (author) headers['x-author'] = author;
  if (adminPassword) headers['x-admin-password'] = adminPassword;
  if (readerToken) headers['x-reader-token'] = readerToken;

  let url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  // ponytail: query fallback if a proxy strips custom headers
  if (author && !url.includes('author=')) {
    url += `${url.includes('?') ? '&' : '?'}author=${encodeURIComponent(author)}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...fetchOptions, headers });
  } catch {
    throw new Error(`Cannot reach API at ${API_URL} (network/CORS?)`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText || `HTTP ${res.status}` }));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface Letter {
  id: string;
  title: string;
  content: string;
  template: string;
  author: string;
  reply_to?: string | null;
  reply_to_title?: string | null;
  created_at: string;
}

export interface LetterStats extends Letter {
  read_count: number;
  total_read_seconds: number;
  last_read_at: string | null;
  sessions?: ReadingSession[];
}

export interface ReadingSession {
  id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  user_agent: string | null;
}

export interface ArchiveLetter {
  id: string;
  title: string;
  template: string;
  author: string;
  created_at: string;
}

export interface TimelineLetter {
  id: string;
  title: string;
  author: string;
  reply_to?: string | null;
  reply_to_title?: string | null;
  created_at: string;
}

export function formatTimelineDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTimelineTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function groupLettersByDate(letters: TimelineLetter[]) {
  const groups: { date: string; letters: TimelineLetter[] }[] = [];
  for (const letter of letters) {
    const date = formatTimelineDate(letter.created_at);
    const last = groups[groups.length - 1];
    if (last?.date === date) {
      last.letters.push(letter);
    } else {
      groups.push({ date, letters: [letter] });
    }
  }
  return groups;
}

export const TEMPLATES = [
  {
    id: 'daisy-paper',
    name: 'Daisy Meadow',
    background: '/backgrounds/daisy-paper.jpg',
    description: 'Vintage paper with white daisies',
  },
  {
    id: 'torn-beige',
    name: 'Torn Beige',
    background: '/backgrounds/torn-beige.jpg',
    description: 'Aged beige paper with torn edges',
  },
  {
    id: 'christmas-letter',
    name: 'Christmas Letter',
    background: '/backgrounds/christmas-letter.jpg',
    description: 'Vintage Christmas letter paper',
  },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]['id'];

export function formatDuration(seconds: number): string {  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours} hr ${remainMins} min`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
