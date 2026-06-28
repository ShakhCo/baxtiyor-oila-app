import { initData } from '@tma.js/sdk-react';

const API_BASE = '/api';

function authHeader(): Record<string, string> {
  const raw = initData.raw();
  return raw ? { Authorization: `tma ${raw}` } : {};
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      // FormData sets its own multipart Content-Type (with boundary); only JSON bodies need this
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...authHeader(),
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try { json = JSON.parse(text); } catch { /* leave null */ }
  }

  if (!res.ok) {
    const message =
      (json && typeof json === 'object' && 'detail' in (json as Record<string, unknown>)
        ? String((json as Record<string, unknown>).detail)
        : text) || res.statusText;
    const err = new Error(`${res.status} ${message}`);
    (err as Error & { status?: number; payload?: unknown }).status = res.status;
    (err as Error & { status?: number; payload?: unknown }).payload = json;
    throw err;
  }

  return json as T;
}

/** Cache TTLs (ms) for GET requests that opt in via apiGet(path, { ttl }). */
export const CACHE_TTL = {
  list:   3 * 60_000,   // anketa list
  detail: 10 * 60_000,  // anketa details
} as const;

type CacheEntry = { ts: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * GET with an optional in-memory TTL cache. A fresh cached value is returned
 * immediately; concurrent calls for the same path share one request. Mutations
 * should call `invalidate()` to drop stale entries.
 */
export function apiGet<T>(path: string, opts?: { ttl?: number }): Promise<T> {
  const ttl = opts?.ttl ?? 0;
  if (ttl <= 0) return request<T>(path, { method: 'GET' });

  const hit = cache.get(path);
  if (hit && Date.now() - hit.ts < ttl) return Promise.resolve(hit.data as T);

  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;

  const p = request<T>(path, { method: 'GET' })
    .then(data => { cache.set(path, { ts: Date.now(), data }); return data; })
    .finally(() => inflight.delete(path));
  inflight.set(path, p as Promise<unknown>);
  return p;
}

/** Drop every cached GET whose path starts with `prefix`. */
export function invalidate(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

/** multipart upload — pass a FormData; the browser sets the boundary header */
export function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body: form });
}
