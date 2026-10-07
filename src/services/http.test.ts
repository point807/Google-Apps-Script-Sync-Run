/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './http';

const ok = () => new Response('{}', { status: 200 });
const statusRes = (status: number, headers: Record<string, string> = {}) =>
  new Response('{}', { status, headers });

let calls: { url: string; method: string }[] = [];

const mockFetch = (impl: (url: string, init: RequestInit) => Promise<Response> | Response) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), method: (init.method || 'GET').toUpperCase() });
      return impl(url, init);
    })
  );
};

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('passes through successful responses without retry', async () => {
    mockFetch(() => ok());
    const res = await apiFetch('/x', { retryDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it('retries GET on 500 and succeeds', async () => {
    let n = 0;
    mockFetch(() => (++n === 1 ? statusRes(500) : ok()));
    const res = await apiFetch('/x', { retryDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it('returns the failing response after exhausting retries (GET/5xx)', async () => {
    mockFetch(() => statusRes(503));
    const res = await apiFetch('/x', { maxRetries: 2, retryDelayMs: 1 });
    expect(res.status).toBe(503);
    expect(calls).toHaveLength(3); // 1 try + 2 retries
  });

  it('does NOT retry POST on 500', async () => {
    mockFetch(() => statusRes(500));
    const res = await apiFetch('/x', { method: 'POST', retryDelayMs: 1 });
    expect(res.status).toBe(500);
    expect(calls).toHaveLength(1);
  });

  it('retries POST on 429 (request was rejected, not processed)', async () => {
    let n = 0;
    mockFetch(() => (++n === 1 ? statusRes(429) : ok()));
    const res = await apiFetch('/x', { method: 'POST', retryDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe('POST');
  });

  it('honors the Retry-After header', async () => {
    let n = 0;
    mockFetch(() => (++n === 1 ? statusRes(429, { 'Retry-After': '0' }) : ok()));
    const start = Date.now();
    const res = await apiFetch('/x', { retryDelayMs: 10_000 });
    expect(res.status).toBe(200);
    // Retry-After: 0 -> no 10s backoff delay
    expect(Date.now() - start).toBeLessThan(2000);
    expect(calls).toHaveLength(2);
  });

  it('retries network errors for GET and throws after the limit', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(apiFetch('/x', { maxRetries: 2, retryDelayMs: 1 })).rejects.toThrow(
      'Failed to fetch'
    );
    expect(calls).toHaveLength(3);
  });

  it('does not retry network errors for POST', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(apiFetch('/x', { method: 'POST', retryDelayMs: 1 })).rejects.toThrow(
      'Failed to fetch'
    );
    expect(calls).toHaveLength(1);
  });

  it('retries PUT and DELETE on 500 (idempotent)', async () => {
    let n = 0;
    mockFetch(() => (++n === 1 ? statusRes(500) : ok()));
    const res = await apiFetch('/x', { method: 'PUT', retryDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
  });
});
