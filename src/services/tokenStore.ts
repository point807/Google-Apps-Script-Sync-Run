/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GitHubConfig } from '../types';

/**
 * GitHub token storage.
 *
 * Policy:
 * - default: sessionStorage — the token dies when the tab closes;
 * - opt-in "remember": localStorage — persists across browser restarts, user accepts the risk;
 * - the token is NEVER stored inside `scriptvault_gh_config` (that key is public settings only).
 *
 * Legacy builds (pre Phase B) kept raw tokens in localStorage under
 * `scriptvault_gh_config.token` and `scriptvault_saved_github_tokens`.
 * `loadToken()` scrubs those locations and migrates the newest token once.
 */

const SESSION_KEY = 'scriptvault_github_token';
const LOCAL_KEY = 'scriptvault_github_token_remembered';
const LEGACY_CONFIG_KEY = 'scriptvault_gh_config';
const LEGACY_VAULT_KEY = 'scriptvault_saved_github_tokens';

export interface StoredToken {
  token: string;
  username?: string;
  remembered: boolean;
}

/** Display mask: keeps only the first and last 4 characters (e.g. ghp_••••••ab12). */
export const maskToken = (token: string): string => {
  const clean = (token || '').trim();
  if (!clean) return '';
  if (clean.length <= 8) return '••••••••';
  return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`;
};

const parse = (raw: string | null): StoredToken | null => {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data && typeof data.token === 'string' && data.token) {
      return {
        token: data.token,
        username: typeof data.username === 'string' ? data.username : undefined,
        remembered: !!data.remembered
      };
    }
  } catch {
    // ignore corrupted entries
  }
  return null;
};

export const saveToken = (token: string, opts: { remember: boolean; username?: string }): void => {
  const clean = token.trim();
  if (!clean) return;
  const payload = JSON.stringify({
    token: clean,
    username: opts.username,
    remembered: opts.remember
  });
  // Session copy always exists so the tab survives a refresh.
  sessionStorage.setItem(SESSION_KEY, payload);
  if (opts.remember) {
    localStorage.setItem(LOCAL_KEY, payload);
  } else {
    localStorage.removeItem(LOCAL_KEY);
  }
};

/** Removes the token from both storages. */
export const clearToken = (): void => {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LOCAL_KEY);
};

export const isRemembered = (): boolean => localStorage.getItem(LOCAL_KEY) !== null;

/**
 * Migrates raw tokens from legacy localStorage keys and scrubs them.
 * The newest legacy token is kept active (as remembered — it was persistent before).
 */
const migrateLegacyTokens = (): void => {
  const alreadyStored = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(LOCAL_KEY);

  // 1) `scriptvault_gh_config` used to embed the raw token — strip the field.
  try {
    const raw = localStorage.getItem(LEGACY_CONFIG_KEY);
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg && typeof cfg === 'object') {
        const legacyToken = typeof cfg.token === 'string' ? cfg.token : '';
        if (legacyToken && !alreadyStored) {
          saveToken(legacyToken, { remember: true, username: cfg.owner || undefined });
        }
        if ('token' in cfg) {
          const { token: _token, ...rest } = cfg;
          localStorage.setItem(LEGACY_CONFIG_KEY, JSON.stringify(rest));
        }
      }
    }
  } catch {
    // ignore
  }

  // 2) The old multi-token vault stored a list of raw tokens — keep the newest, drop the list.
  try {
    const raw = localStorage.getItem(LEGACY_VAULT_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      const current =
        sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(LOCAL_KEY) || null;
      if (Array.isArray(list) && list.length > 0 && !current) {
        const newest = list[0];
        if (newest && typeof newest.token === 'string' && newest.token) {
          saveToken(newest.token, {
            remember: true,
            username: typeof newest.username === 'string' ? newest.username : undefined
          });
        }
      }
    }
  } catch {
    // ignore
  }
  // The vault is always deleted: raw tokens must not linger in localStorage.
  localStorage.removeItem(LEGACY_VAULT_KEY);
};

export const loadToken = (): StoredToken | null => {
  migrateLegacyTokens();
  return parse(sessionStorage.getItem(SESSION_KEY)) ?? parse(localStorage.getItem(LOCAL_KEY));
};

/** Persists only the non-secret parts of the GitHub config. */
export const persistGitHubConfig = (config: GitHubConfig): void => {
  const { token: _token, ...rest } = config;
  try {
    localStorage.setItem(LEGACY_CONFIG_KEY, JSON.stringify(rest));
  } catch {
    // ignore
  }
};
