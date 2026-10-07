/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { openDB, type IDBPDatabase } from 'idb';
import { GitCommit } from '../types';

/**
 * IndexedDB-backed storage for large app data.
 *
 * Commit history holds full file snapshots and outgrows the ~5 MB
 * localStorage quota quickly — it lives here instead. Small settings
 * (theme, sync config, GitHub connection) stay in localStorage.
 */

const DB_NAME = 'scriptvault';
const DB_VERSION = 1;
const COMMITS_STORE = 'commits'; // key: scriptId -> GitCommit[]
const KV_STORE = 'kv';

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = (): Promise<IDBPDatabase> => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(COMMITS_STORE)) {
          db.createObjectStore(COMMITS_STORE);
        }
        if (!db.objectStoreNames.contains(KV_STORE)) {
          db.createObjectStore(KV_STORE);
        }
      }
    });
  }
  return dbPromise;
};

/** Commit history per script (one record per scriptId). */
export const commitsStorage = {
  async get(scriptId: string): Promise<GitCommit[] | undefined> {
    const db = await getDB();
    return db.get(COMMITS_STORE, scriptId) as Promise<GitCommit[] | undefined>;
  },

  async set(scriptId: string, commits: GitCommit[]): Promise<void> {
    const db = await getDB();
    await db.put(COMMITS_STORE, commits, scriptId);
  },

  async delete(scriptId: string): Promise<void> {
    const db = await getDB();
    await db.delete(COMMITS_STORE, scriptId);
  },

  async listScriptIds(): Promise<string[]> {
    const db = await getDB();
    return db.getAllKeys(COMMITS_STORE) as Promise<string[]>;
  }
};

/** Generic key-value store for future large blobs (e.g. Drive snapshots). */
export const kvStorage = {
  async get<T>(key: string): Promise<T | undefined> {
    const db = await getDB();
    return db.get(KV_STORE, key) as Promise<T | undefined>;
  },

  async set<T>(key: string, value: T): Promise<void> {
    const db = await getDB();
    await db.put(KV_STORE, value, key);
  },

  async delete(key: string): Promise<void> {
    const db = await getDB();
    await db.delete(KV_STORE, key);
  }
};
