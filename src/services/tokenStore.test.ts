/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearToken,
  isRemembered,
  loadToken,
  maskToken,
  persistGitHubConfig,
  saveToken
} from './tokenStore';
import { GitHubConfig } from '../types';

const baseConfig: GitHubConfig = {
  token: 'ghp_secret_token_value',
  owner: 'octo',
  repo: 'repo',
  branch: 'main',
  path: '',
  autoPush: true,
  connected: true
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('maskToken', () => {
  it('keeps only first and last 4 characters', () => {
    expect(maskToken('ghp_abcdefgh12345678')).toBe('ghp_••••••••5678');
  });

  it('fully hides short tokens', () => {
    expect(maskToken('short')).toBe('••••••••');
    expect(maskToken('')).toBe('');
  });
});

describe('saveToken / loadToken', () => {
  it('stores token in sessionStorage by default', () => {
    saveToken('ghp_abc123', { remember: false, username: 'octo' });
    expect(isRemembered()).toBe(false);
    const loaded = loadToken();
    expect(loaded?.token).toBe('ghp_abc123');
    expect(loaded?.username).toBe('octo');
    // raw token must NOT be in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      expect(localStorage.getItem(key)).not.toContain('ghp_abc123');
    }
  });

  it('persists to localStorage only when remember is set', () => {
    saveToken('ghp_abc123', { remember: true });
    expect(isRemembered()).toBe(true);
    expect(localStorage.getItem('scriptvault_github_token_remembered')).toContain('ghp_abc123');
  });

  it('remember=false removes a previously remembered token', () => {
    saveToken('ghp_abc123', { remember: true });
    saveToken('ghp_abc123', { remember: false });
    expect(isRemembered()).toBe(false);
  });

  it('clearToken wipes both storages', () => {
    saveToken('ghp_abc123', { remember: true });
    clearToken();
    expect(loadToken()).toBeNull();
    expect(isRemembered()).toBe(false);
  });

  it('ignores empty tokens', () => {
    saveToken('   ', { remember: true });
    expect(loadToken()).toBeNull();
  });
});

describe('persistGitHubConfig', () => {
  it('strips the token before writing to localStorage', () => {
    persistGitHubConfig(baseConfig);
    const raw = localStorage.getItem('scriptvault_gh_config')!;
    expect(raw).not.toContain('ghp_secret_token_value');
    const parsed = JSON.parse(raw);
    expect(parsed.owner).toBe('octo');
    expect(parsed.token).toBeUndefined();
  });
});

describe('legacy migration', () => {
  it('migrates token from legacy gh_config and scrubs the key', () => {
    localStorage.setItem('scriptvault_gh_config', JSON.stringify(baseConfig));

    const loaded = loadToken();
    expect(loaded?.token).toBe('ghp_secret_token_value');
    expect(loaded?.remembered).toBe(true); // legacy token was persistent

    const raw = localStorage.getItem('scriptvault_gh_config')!;
    expect(raw).not.toContain('ghp_secret_token_value');
  });

  it('keeps the newest vault token and deletes the vault', () => {
    localStorage.setItem(
      'scriptvault_saved_github_tokens',
      JSON.stringify([
        { id: '1', name: 'newest', token: 'ghp_newest_token', username: 'new' },
        { id: '2', name: 'older', token: 'ghp_older_token', username: 'old' }
      ])
    );

    const loaded = loadToken();
    expect(loaded?.token).toBe('ghp_newest_token');
    expect(localStorage.getItem('scriptvault_saved_github_tokens')).toBeNull();
    // the other raw token must be gone too
    expect(localStorage.getItem('scriptvault_saved_github_tokens') || '').not.toContain(
      'ghp_older_token'
    );
  });

  it('prefers the active legacy config token over the vault', () => {
    localStorage.setItem('scriptvault_gh_config', JSON.stringify(baseConfig));
    localStorage.setItem(
      'scriptvault_saved_github_tokens',
      JSON.stringify([{ id: '1', name: 'vault', token: 'ghp_vault_token' }])
    );

    const loaded = loadToken();
    expect(loaded?.token).toBe('ghp_secret_token_value');
    expect(localStorage.getItem('scriptvault_saved_github_tokens')).toBeNull();
  });

  it('does not overwrite a token that is already stored', () => {
    saveToken('ghp_current', { remember: false });
    localStorage.setItem('scriptvault_gh_config', JSON.stringify(baseConfig));

    expect(loadToken()?.token).toBe('ghp_current');
  });

  it('survives corrupted legacy data', () => {
    localStorage.setItem('scriptvault_saved_github_tokens', 'not-json{');
    localStorage.setItem('scriptvault_gh_config', 'also-not-json');
    expect(loadToken()).toBeNull();
    expect(localStorage.getItem('scriptvault_saved_github_tokens')).toBeNull();
  });
});
