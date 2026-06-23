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

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
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
