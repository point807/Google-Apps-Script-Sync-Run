/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPullRequest, createBranch } from './githubService';

const okJson = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => JSON.stringify(data)
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('github PR', () => {
  it('createBranch fetches base SHA and creates ref', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ object: { sha: 'base123' } })) // get base ref
      .mockResolvedValueOnce(okJson({ ref: 'refs/heads/new-branch' })); // create ref

    await createBranch('tok', 'owner', 'repo', 'new-branch', 'main');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url1] = fetchMock.mock.calls[0];
    expect(String(url1)).toContain('/git/ref/heads/main');
    const [, init2] = fetchMock.mock.calls[1];
    const body = JSON.parse(String((init2 as RequestInit).body));
    expect(body.ref).toBe('refs/heads/new-branch');
    expect(body.sha).toBe('base123');
  });

  it('createPullRequest posts to pulls endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ number: 42, html_url: 'https://github.com/o/r/pull/42', title: 'My PR' })
    );

    const pr = await createPullRequest('tok', 'owner', 'repo', 'feature', 'main', 'My PR', 'Body');

    expect(pr.number).toBe(42);
    expect(pr.html_url).toContain('/pull/42');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/repos/owner/repo/pulls');
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.head).toBe('feature');
    expect(body.base).toBe('main');
    expect(body.title).toBe('My PR');
  });

  it('createPullRequest throws on failure', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Validation failed' }),
      text: async () => 'Validation failed'
    });

    await expect(createPullRequest('tok', 'o', 'r', 'h', 'b', 't')).rejects.toThrow(/Failed to create pull request/);
  });
});
