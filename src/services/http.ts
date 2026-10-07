/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared fetch wrapper with retry.
 *
 * Retry policy (safe for non-idempotent requests):
 * - 429 Too Many Requests → always retried (the request was rejected, not processed);
 * - network errors and 5xx → retried only for idempotent methods (GET/HEAD/PUT/DELETE);
 * - honors the `Retry-After` header, otherwise exponential backoff with jitter;
 * - never retries a response that is not retryable — the Response is returned as-is
 *   so callers keep their existing error handling.
 */

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE']);

export interface ApiFetchOptions extends RequestInit {
  /** Maximum retry attempts after the first try. Default 3. */
  maxRetries?: number;
  /** Base backoff delay in ms (doubles each attempt). Default 300. */
  retryDelayMs?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const backoffDelay = (attempt: number, base: number): number =>
  base * 2 ** attempt + Math.floor(Math.random() * 100);

export const apiFetch = async (url: string, options: ApiFetchOptions = {}): Promise<Response> => {
  const { maxRetries = 3, retryDelayMs = 300, ...init } = options;
  const method = (init.method || 'GET').toUpperCase();
  const idempotent = IDEMPOTENT_METHODS.has(method);

  let attempt = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      if (attempt >= maxRetries || !idempotent || (init.signal && init.signal.aborted)) {
        throw err;
      }
      await sleep(backoffDelay(attempt, retryDelayMs));
      attempt++;
      continue;
    }

    if (res.ok) return res;

    const retriable = res.status === 429 || (res.status >= 500 && idempotent);
    if (!retriable || attempt >= maxRetries) return res;

    const retryAfterRaw = res.headers.get('Retry-After');
    // Retry-After: 0 means "retry immediately"; absent/invalid header -> exponential backoff
    const retryAfter = retryAfterRaw !== null ? Number(retryAfterRaw) : NaN;
    const delay =
      Number.isFinite(retryAfter) && retryAfter >= 0
        ? retryAfter * 1000
        : backoffDelay(attempt, retryDelayMs);
    await sleep(delay);
    attempt++;
  }
};
