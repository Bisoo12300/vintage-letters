'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { SiteShell } from '@/components/SiteShell';
import { useIdentity } from '@/components/IdentityGate';
import { apiFetch, formatDate, type DatePlan } from '@/lib/api';
import { authorEmoji, authorLabel } from '@/lib/identity';

const STATUS_LABEL: Record<DatePlan['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
};

function toDatetimeLocalValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PlansPage() {
  const { identity } = useIdentity();
  const [plans, setPlans] = useState<DatePlan[]>([]);
  const [startsAt, setStartsAt] = useState(toDatetimeLocalValue);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!identity) return;
    const data = await apiFetch<DatePlan[]>('/plans', { author: identity });
    setPlans(data);
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    setLoading(true);
    setError('');
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load plans'))
      .finally(() => setLoading(false));
  }, [identity, load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!identity || !startsAt) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch<DatePlan>('/plans', {
        method: 'POST',
        author: identity,
        body: JSON.stringify({
          startsAt: new Date(startsAt).toISOString(),
          note,
        }),
      });
      setNote('');
      setStartsAt(toDatetimeLocalValue());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create plan');
    } finally {
      setSaving(false);
    }
  }

  async function respond(id: string, action: 'accept' | 'decline') {
    if (!identity) return;
    setError('');
    try {
      await apiFetch(`/plans/${id}/${action}`, { method: 'POST', author: identity });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action}`);
    }
  }

  async function remove(id: string) {
    if (!identity) return;
    setError('');
    try {
      await apiFetch(`/plans/${id}`, { method: 'DELETE', author: identity });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <header className="mb-10 text-center">
          <h1 className="font-display text-3xl font-semibold text-mora-brown-800">Plans</h1>
          <p className="font-body mt-2 text-lg text-mora-brown-500">
            Propose a hangout — the other accepts or declines
          </p>
        </header>

        <form onSubmit={handleCreate} className="mora-card mb-8 space-y-4">
          <div>
            <label htmlFor="startsAt" className="font-body mb-1 block text-sm text-mora-brown-600">
              When
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-xl border border-mora-beige-200 bg-mora-cream px-4 py-2.5 font-body text-mora-brown-800"
            />
          </div>
          <div>
            <label htmlFor="note" className="font-body mb-1 block text-sm text-mora-brown-600">
              Note
            </label>
            <textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Coffee, walk, movie…"
              className="w-full rounded-xl border border-mora-beige-200 bg-mora-cream px-4 py-2.5 font-body text-mora-brown-800"
            />
          </div>
          <button type="submit" className="mora-btn-primary text-sm" disabled={saving || !identity}>
            {saving ? 'Saving…' : 'Propose'}
          </button>
        </form>

        {error && <p className="font-body mb-4 text-center text-sm text-red-700">{error}</p>}
        {loading && (
          <p className="font-body text-center text-mora-brown-400">Loading plans…</p>
        )}

        {!loading && plans.length === 0 ? (
          <div className="mora-card text-center">
            <p className="font-body text-mora-brown-500">No plans yet. Propose the first one.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {plans.map((plan) => {
              const canRespond =
                plan.status === 'pending' && identity && plan.proposed_by !== identity;
              return (
                <li key={plan.id} className="mora-card !p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl font-medium text-mora-brown-800">
                        {formatDate(plan.starts_at)}
                      </p>
                      <p className="font-body mt-1 text-sm text-mora-brown-500">
                        {authorEmoji(plan.proposed_by)} {authorLabel(plan.proposed_by)} ·{' '}
                        {STATUS_LABEL[plan.status]}
                      </p>
                      {plan.note && (
                        <p className="font-body mt-3 whitespace-pre-wrap text-mora-brown-700">
                          {plan.note}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canRespond && (
                        <>
                          <button
                            type="button"
                            className="mora-btn-primary text-sm"
                            onClick={() => respond(plan.id, 'accept')}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="mora-btn text-sm"
                            onClick={() => respond(plan.id, 'decline')}
                          >
                            Decline
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="mora-btn border-red-200 text-sm text-red-700 hover:border-red-300"
                        onClick={() => remove(plan.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}
