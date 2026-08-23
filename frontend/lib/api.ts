const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { adminPassword?: string; readerToken?: string } = {}
): Promise<T> {
  const { adminPassword, readerToken, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (adminPassword) headers['x-admin-password'] = adminPassword;
  if (readerToken) headers['x-reader-token'] = readerToken;

  const res = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export interface Letter {
  id: string;
  title: string;
  content: string;
  template: string;
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
  created_at: string;
}

export interface TimelineLetter {
  id: string;
  title: string;
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
] as const;

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
