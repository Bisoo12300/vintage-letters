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
  readers?: LetterReader[];
}

export interface LetterReader {
  reader: string;
  last_read_at: string;
}

export interface ReadingSession {
  id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  user_agent: string | null;
  reader?: string | null;
}

export interface InboxLetter {
  id: string;
  title: string;
  template: string;
  author: string;
  created_at: string;
  unread: boolean;
}

export interface DatePlan {
  id: string;
  proposed_by: string;
  starts_at: string;
  note: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
}

export interface Milestone {
  id: string;
  title: string;
  mode: 'countdown' | 'countup';
  at: string;
  created_by: 'moon' | 'sun';
  created_at: string;
  updated_at: string;
}

export interface MoodOption {
  emoji: string;
  label: string;
}

export interface MoodEntry {
  author: 'moon' | 'sun';
  day: string;
  emoji: string;
  note: string;
  updated_at: string;
}

export interface CatState {
  owner: 'moon' | 'sun';
  name: string;
  born_at: string;
  last_fed_at: string | null;
  last_fed_by: 'moon' | 'sun' | null;
  feed_count: number;
  xp: number;
  /** Whose house the cat is at right now */
  location: 'moon' | 'sun';
  fullness: number;
  hungry: boolean;
  canFeed: boolean;
  asleep: boolean;
  stage: { index: 0 | 1 | 2 | 3; key: string; label: string; next: number | null; progress: number };
}

export interface PetsState {
  day: string;
  streak: number;
  today: { moon: MoodEntry | null; sun: MoodEntry | null };
  moods: MoodOption[];
  cats: { moon: CatState; sun: CatState };
}

/** Fired on window after anything that can change the cats (a letter sent, a meal, a mood). */
export const PETS_CHANGED = 'pets:changed';


/** @deprecated use InboxLetter */
export type ArchiveLetter = InboxLetter;

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

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
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
