'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Modal } from '@/components/crm/Modal';
import { useIdentity } from '@/components/IdentityGate';
import {
  apiFetch,
  formatDate,
  formatDuration,
  TEMPLATES,
  type DatePlan,
  type InboxLetter,
  type Letter,
  type LetterStats,
  type TemplateId,
} from '@/lib/api';
import { authorEmoji, authorLabel } from '@/lib/identity';

type TabId = 'inbox' | 'letters' | 'plans';

const STATUS_LABEL: Record<DatePlan['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
};

const emptyLetter = { title: '', content: '', template: TEMPLATES[0].id as string };

function toDatetimeLocalValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CrmDashboardInner() {
  const { identity } = useIdentity();
  const searchParams = useSearchParams();
  const replyToId = searchParams.get('reply_to');

  const [tab, setTab] = useState<TabId>('inbox');
  const [inbox, setInbox] = useState<InboxLetter[]>([]);
  const [letters, setLetters] = useState<LetterStats[]>([]);
  const [plans, setPlans] = useState<DatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [letterModal, setLetterModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [letterForm, setLetterForm] = useState(emptyLetter);
  const [replyParent, setReplyParent] = useState<Letter | null>(null);
  const [statsModal, setStatsModal] = useState<LetterStats | null>(null);

  const [planModal, setPlanModal] = useState(false);
  const [planStartsAt, setPlanStartsAt] = useState(toDatetimeLocalValue);
  const [planNote, setPlanNote] = useState('');

  const refresh = useCallback(async () => {
    if (!identity) return;
    const [inboxData, lettersData, plansData] = await Promise.all([
      apiFetch<InboxLetter[]>('/inbox', { author: identity }),
      apiFetch<LetterStats[]>('/letters', { author: identity }),
      apiFetch<DatePlan[]>('/plans', { author: identity }),
    ]);
    setInbox(inboxData);
    setLetters(lettersData);
    setPlans(plansData);
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    setLoading(true);
    setError('');
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [identity, refresh]);

  useEffect(() => {
    if (!replyToId) {
      setReplyParent(null);
      return;
    }
    setTab('letters');
    setEditingId(null);
    setLetterForm(emptyLetter);
    setLetterModal(true);
    apiFetch<Letter>(`/letters/${replyToId}`)
      .then(setReplyParent)
      .catch(() => setReplyParent(null));
  }, [replyToId]);

  const unread = inbox.filter((l) => l.unread).length;
  const pendingPlans = plans.filter((p) => p.status === 'pending').length;

  function openNewLetter() {
    setEditingId(null);
    setLetterForm(emptyLetter);
    setReplyParent(null);
    setLetterModal(true);
  }

  function openEditLetter(letter: LetterStats) {
    setEditingId(letter.id);
    setLetterForm({
      title: letter.title,
      content: letter.content,
      template: letter.template as TemplateId,
    });
    setReplyParent(null);
    setLetterModal(true);
  }

  async function openStats(id: string) {
    if (!identity) return;
    try {
      const data = await apiFetch<LetterStats>(`/letters/${id}/stats`, { author: identity });
      setStatsModal(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load stats');
    }
  }

  async function saveLetter(e: FormEvent) {
    e.preventDefault();
    if (!identity) return;
    setBusy(true);
    setError('');
    try {
      if (editingId) {
        await apiFetch(`/letters/${editingId}`, {
          method: 'PUT',
          author: identity,
          body: JSON.stringify(letterForm),
        });
      } else {
        await apiFetch('/letters', {
          method: 'POST',
          author: identity,
          body: JSON.stringify({
            ...letterForm,
            ...(replyToId && !editingId ? { reply_to: replyToId } : {}),
          }),
        });
      }
      setLetterModal(false);
      await refresh();
      setTab('letters');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteLetter(id: string) {
    if (!identity || !confirm('Delete this letter permanently?')) return;
    setBusy(true);
    try {
      await apiFetch(`/letters/${id}`, { method: 'DELETE', author: identity });
      setLetterModal(false);
      setStatsModal(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(e: FormEvent) {
    e.preventDefault();
    if (!identity) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch('/plans', {
        method: 'POST',
        author: identity,
        body: JSON.stringify({
          startsAt: new Date(planStartsAt).toISOString(),
          note: planNote,
        }),
      });
      setPlanModal(false);
      setPlanNote('');
      setPlanStartsAt(toDatetimeLocalValue());
      await refresh();
      setTab('plans');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create plan');
    } finally {
      setBusy(false);
    }
  }

  async function respondPlan(id: string, action: 'accept' | 'decline') {
    if (!identity) return;
    try {
      await apiFetch(`/plans/${id}/${action}`, { method: 'POST', author: identity });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action}`);
    }
  }

  async function deletePlan(id: string) {
    if (!identity) return;
    try {
      await apiFetch(`/plans/${id}`, { method: 'DELETE', author: identity });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'inbox', label: 'Inbox', count: unread || undefined },
    { id: 'letters', label: 'My letters', count: letters.length || undefined },
    { id: 'plans', label: 'Plans', count: pendingPlans || undefined },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-body text-xs font-medium tracking-wider text-mora-brown-500 uppercase">
            Dashboard
          </p>
          <h1 className="font-display text-2xl font-semibold text-mora-brown-800 sm:text-3xl">
            Clair de Lune
          </h1>
          <p className="font-body mt-1 text-sm text-mora-brown-500">
            {identity
              ? `${authorEmoji(identity)} ${authorLabel(identity)} — letters, inbox & plans`
              : 'Choose identity to continue'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="mora-btn-primary text-sm" onClick={openNewLetter}>
            + Letter
          </button>
          <button
            type="button"
            className="mora-btn text-sm"
            onClick={() => {
              setPlanStartsAt(toDatetimeLocalValue());
              setPlanNote('');
              setPlanModal(true);
            }}
          >
            + Plan
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-mora-beige-100 bg-white px-4 py-3 shadow-soft">
          <p className="font-body text-xs text-mora-brown-500">Unread</p>
          <p className="font-display text-2xl font-semibold text-mora-brown-800">{unread}</p>
        </div>
        <div className="rounded-xl border border-mora-beige-100 bg-white px-4 py-3 shadow-soft">
          <p className="font-body text-xs text-mora-brown-500">My letters</p>
          <p className="font-display text-2xl font-semibold text-mora-brown-800">{letters.length}</p>
        </div>
        <div className="rounded-xl border border-mora-beige-100 bg-white px-4 py-3 shadow-soft">
          <p className="font-body text-xs text-mora-brown-500">Pending plans</p>
          <p className="font-display text-2xl font-semibold text-mora-brown-800">{pendingPlans}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-mora-beige-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 font-body text-sm transition ${
              tab === t.id
                ? 'border-b-2 border-mora-brown-600 font-medium text-mora-brown-800'
                : 'text-mora-brown-500 hover:text-mora-brown-700'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-mora-brown-600 px-1 text-[10px] font-bold text-white">
                {t.count > 9 ? '9+' : t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="font-body mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {loading && <p className="font-body text-sm text-mora-brown-400">Loading…</p>}

      {!loading && tab === 'inbox' && (
        <div className="overflow-hidden rounded-xl border border-mora-beige-100 bg-white shadow-soft">
          {inbox.length === 0 ? (
            <p className="font-body px-4 py-10 text-center text-mora-brown-500">Inbox empty.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-mora-beige-100 bg-mora-beige-50/80 font-body text-xs text-mora-brown-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">From</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="font-body text-sm">
                {inbox.map((letter) => (
                  <tr
                    key={letter.id}
                    className="border-b border-mora-beige-50 last:border-0 hover:bg-mora-beige-50/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/letter/${letter.id}`}
                        className="font-medium text-mora-brown-800 hover:underline"
                      >
                        {letter.title}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-mora-brown-600 sm:table-cell">
                      {authorEmoji(letter.author)} {authorLabel(letter.author)}
                    </td>
                    <td className="hidden px-4 py-3 text-mora-brown-500 md:table-cell">
                      {formatDate(letter.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {letter.unread ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Unread
                        </span>
                      ) : (
                        <span className="text-xs text-mora-brown-400">Read</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!loading && tab === 'letters' && (
        <div className="overflow-hidden rounded-xl border border-mora-beige-100 bg-white shadow-soft">
          {letters.length === 0 ? (
            <p className="font-body px-4 py-10 text-center text-mora-brown-500">
              No letters yet.{' '}
              <button type="button" className="underline" onClick={openNewLetter}>
                Write one
              </button>
            </p>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-mora-beige-100 bg-mora-beige-50/80 font-body text-xs text-mora-brown-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Reads</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body text-sm">
                {letters.map((letter) => (
                  <tr
                    key={letter.id}
                    className="border-b border-mora-beige-50 last:border-0 hover:bg-mora-beige-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-mora-brown-800">{letter.title}</td>
                    <td className="hidden px-4 py-3 text-mora-brown-600 sm:table-cell">
                      {letter.read_count} · {formatDuration(letter.total_read_seconds)}
                    </td>
                    <td className="hidden px-4 py-3 text-mora-brown-500 md:table-cell">
                      {formatDate(letter.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-mora-brown-700 underline"
                          onClick={() => openEditLetter(letter)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-mora-brown-700 underline"
                          onClick={() => openStats(letter.id)}
                        >
                          Stats
                        </button>
                        <Link
                          href={`/letter/${letter.id}`}
                          className="text-xs font-medium text-mora-brown-700 underline"
                        >
                          Open
                        </Link>
                        <Link
                          href={`/qr/${letter.id}`}
                          className="text-xs font-medium text-mora-brown-700 underline"
                        >
                          QR
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!loading && tab === 'plans' && (
        <div className="overflow-hidden rounded-xl border border-mora-beige-100 bg-white shadow-soft">
          {plans.length === 0 ? (
            <p className="font-body px-4 py-10 text-center text-mora-brown-500">No plans yet.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-mora-beige-100 bg-mora-beige-50/80 font-body text-xs text-mora-brown-500">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">By</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body text-sm">
                {plans.map((plan) => {
                  const canRespond =
                    plan.status === 'pending' && identity && plan.proposed_by !== identity;
                  return (
                    <tr
                      key={plan.id}
                      className="border-b border-mora-beige-50 last:border-0 hover:bg-mora-beige-50/50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-mora-brown-800">{formatDate(plan.starts_at)}</p>
                        {plan.note && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-mora-brown-500">{plan.note}</p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-mora-brown-600 sm:table-cell">
                        {authorEmoji(plan.proposed_by)} {authorLabel(plan.proposed_by)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            plan.status === 'accepted'
                              ? 'bg-green-100 text-green-800'
                              : plan.status === 'declined'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {STATUS_LABEL[plan.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canRespond && (
                            <>
                              <button
                                type="button"
                                className="text-xs font-medium text-green-700 underline"
                                onClick={() => respondPlan(plan.id, 'accept')}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="text-xs font-medium text-red-700 underline"
                                onClick={() => respondPlan(plan.id, 'decline')}
                              >
                                Decline
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="text-xs font-medium text-red-700 underline"
                            onClick={() => deletePlan(plan.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal
        open={letterModal}
        title={editingId ? 'Edit letter' : replyParent ? 'Reply' : 'New letter'}
        onClose={() => setLetterModal(false)}
        wide
      >
        <form onSubmit={saveLetter} className="space-y-4">
          {replyParent && (
            <p className="font-body text-sm italic text-mora-brown-500">
              Replying to {replyParent.title}
            </p>
          )}
          <div>
            <label className="mb-1 block font-body text-sm text-mora-brown-600">Paper</label>
            <select
              className="mora-input"
              value={letterForm.template}
              onChange={(e) => setLetterForm({ ...letterForm, template: e.target.value })}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-body text-sm text-mora-brown-600">Title</label>
            <input
              className="mora-input"
              value={letterForm.title}
              onChange={(e) => setLetterForm({ ...letterForm, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block font-body text-sm text-mora-brown-600">Body</label>
            <textarea
              className="mora-textarea min-h-[160px]"
              value={letterForm.content}
              onChange={(e) => setLetterForm({ ...letterForm, content: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" className="mora-btn-primary text-sm" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </button>
            {editingId && (
              <button
                type="button"
                className="mora-btn border-red-200 text-sm text-red-700"
                disabled={busy}
                onClick={() => deleteLetter(editingId)}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </Modal>

      <Modal open={planModal} title="New plan" onClose={() => setPlanModal(false)}>
        <form onSubmit={savePlan} className="space-y-4">
          <div>
            <label className="mb-1 block font-body text-sm text-mora-brown-600">When</label>
            <input
              type="datetime-local"
              required
              className="mora-input"
              value={planStartsAt}
              onChange={(e) => setPlanStartsAt(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block font-body text-sm text-mora-brown-600">Note</label>
            <textarea
              className="mora-textarea min-h-[100px]"
              value={planNote}
              onChange={(e) => setPlanNote(e.target.value)}
              placeholder="Coffee, walk, movie…"
            />
          </div>
          <button type="submit" className="mora-btn-primary text-sm" disabled={busy}>
            {busy ? 'Saving…' : 'Propose'}
          </button>
        </form>
      </Modal>

      <Modal
        open={!!statsModal}
        title={statsModal ? `Stats · ${statsModal.title}` : 'Stats'}
        onClose={() => setStatsModal(null)}
        wide
      >
        {statsModal && (
          <div className="space-y-4 font-body text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-mora-beige-50 p-4 text-center">
                <p className="font-display text-2xl font-semibold text-mora-brown-800">
                  {statsModal.read_count}
                </p>
                <p className="text-mora-brown-500">Reads</p>
              </div>
              <div className="rounded-xl bg-mora-beige-50 p-4 text-center">
                <p className="font-display text-2xl font-semibold text-mora-brown-800">
                  {formatDuration(statsModal.total_read_seconds)}
                </p>
                <p className="text-mora-brown-500">Total time</p>
              </div>
            </div>
            {statsModal.readers && statsModal.readers.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-mora-brown-500">Read by</p>
                <ul className="space-y-1">
                  {statsModal.readers.map((r) => (
                    <li key={r.reader} className="text-mora-brown-700">
                      {authorEmoji(r.reader)} {authorLabel(r.reader)} · {formatDate(r.last_read_at)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {statsModal.sessions && statsModal.sessions.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-y-auto text-mora-brown-600">
                {statsModal.sessions.map((s) => (
                  <li key={s.id}>
                    {s.reader ? `${authorEmoji(s.reader)} ${authorLabel(s.reader)} · ` : ''}
                    {formatDate(s.started_at)} · {formatDuration(s.duration_seconds)}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 border-t border-mora-beige-100 pt-3">
              <Link href={`/letter/${statsModal.id}`} className="mora-btn text-sm">
                Open
              </Link>
              <Link href={`/qr/${statsModal.id}`} className="mora-btn text-sm">
                QR
              </Link>
              <button
                type="button"
                className="mora-btn text-sm"
                onClick={() => {
                  openEditLetter(statsModal);
                  setStatsModal(null);
                }}
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function CrmDashboard() {
  return (
    <Suspense fallback={<p className="font-body p-8 text-center text-mora-brown-400">Loading…</p>}>
      <CrmDashboardInner />
    </Suspense>
  );
}
