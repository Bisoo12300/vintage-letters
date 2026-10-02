'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { AuthorId } from '@/lib/identity';

interface PageResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * One numbered page of an endpoint that accepts ?limit=&offset= and answers
 * { items, total }. `page` is 1-based. The previous page stays on screen while
 * the next one loads, so the list doesn't jump.
 */
export function usePagination<T>(path: string, author: AuthorId | null, page: number, pageSize = 15) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!author) return;
    let cancelled = false;
    const offset = (page - 1) * pageSize;
    setLoading(true);
    setError('');
    apiFetch<PageResponse<T> | T[]>(`${path}?limit=${pageSize}&offset=${offset}`, { author })
      .then((data) => {
        if (cancelled) return;
        // An older backend ignores ?limit and returns the whole array — page it here
        const pageData = Array.isArray(data)
          ? { items: data.slice(offset, offset + pageSize), total: data.length }
          : data;
        setItems(pageData.items);
        setTotal(pageData.total);
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this page');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, author, page, pageSize, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  /** Patch one row after an edit without refetching the page */
  const updateItem = useCallback((match: (item: T) => boolean, next: T) => {
    setItems((prev) => prev.map((item) => (match(item) ? next : item)));
  }, []);

  return {
    items,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    loading,
    /** True until the first page has arrived */
    initialLoading: loading && !loaded,
    loaded,
    error,
    reload,
    updateItem,
  };
}

/** Reads ?page= from the URL; anything missing or invalid means page 1. */
export function pageFromParams(params: { get(name: string): string | null }) {
  const n = Number.parseInt(params.get('page') ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
