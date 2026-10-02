import type { DatePlan, Milestone } from '@/lib/api';

export interface MomentOnDay {
  milestone: Milestone;
  /** Short caption for a calendar chip, e.g. "Anniversary", "Anniversary · 1 year" */
  caption: string;
}

/**
 * Moments that fall on a calendar day:
 * - countdown ("until") — on its target date
 * - countup ("since")   — on its start date and every yearly anniversary after it
 */
export function momentsOnDay(day: Date, milestones: Milestone[]): MomentOnDay[] {
  const out: MomentOnDay[] = [];
  for (const m of milestones) {
    const at = new Date(m.at);
    if (m.mode === 'countdown') {
      if (sameDay(at, day)) out.push({ milestone: m, caption: m.title });
      continue;
    }
    if (at.getMonth() !== day.getMonth() || at.getDate() !== day.getDate()) continue;
    const years = day.getFullYear() - at.getFullYear();
    if (years < 0) continue;
    out.push({
      milestone: m,
      caption: years === 0 ? m.title : `${m.title} · ${years} ${years === 1 ? 'year' : 'years'}`,
    });
  }
  return out;
}

/** The next `count` plans still on the table (not declined), soonest first. */
export function upcomingPlans(plans: DatePlan[], count = 5, now = new Date()): DatePlan[] {
  return plans
    .filter((p) => p.status !== 'declined' && new Date(p.starts_at).getTime() >= now.getTime())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, count);
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Local calendar date as YYYY-MM-DD (for ?date= links into the Plans week view). */
export function toDateParam(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses ?date=YYYY-MM-DD as local midnight; null when missing or malformed. */
export function fromDateParam(value: string | null): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
