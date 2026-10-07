/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';
import { fetchRemoteCommits, RemoteCommitInfo } from '../services/githubService';

export interface RemoteCommitsFeedProps {
  /** Bump to force a reload (e.g. after pushing). */
  refreshKey?: number;
}

/** Recent remote commits on the active branch with a refresh button. */
export const RemoteCommitsFeed: React.FC<RemoteCommitsFeedProps> = ({ refreshKey = 0 }) => {
  const gitHubConfig = useAppStore((s) => s.gitHubConfig);
  const t = useT('github');
  const [remoteCommits, setRemoteCommits] = useState<RemoteCommitInfo[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);

  async function loadRemoteCommitsList() {
    if (!gitHubConfig.token || !gitHubConfig.owner || !gitHubConfig.repo) return;
    setLoadingCommits(true);
    try {
      const commits = await fetchRemoteCommits(
        gitHubConfig.token,
        gitHubConfig.owner,
        gitHubConfig.repo,
        gitHubConfig.branch || 'main'
      );
      setRemoteCommits(commits);
    } catch (e) {
      console.warn('Failed to load remote commits', e);
    } finally {
      setLoadingCommits(false);
    }
  }

  useEffect(() => {
    if (gitHubConfig.connected && gitHubConfig.owner && gitHubConfig.repo && gitHubConfig.branch) {
      loadRemoteCommitsList();
    }
  }, [gitHubConfig.owner, gitHubConfig.repo, gitHubConfig.branch, refreshKey]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            {t.recentCommitsTitle} <code className="text-purple-300">({gitHubConfig.branch})</code>
          </span>
        </h4>
        <button
          type="button"
          onClick={loadRemoteCommitsList}
          disabled={loadingCommits}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${loadingCommits ? 'animate-spin' : ''}`} />
          <span>{t.refreshCommits}</span>
        </button>
      </div>

      {remoteCommits.length === 0 ? (
        <div className="p-6 rounded-xl bg-slate-950/40 text-xs text-slate-500 text-center font-mono">
          {t.noRemoteCommits}
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl bg-slate-950/60 overflow-hidden font-mono text-xs">
          {remoteCommits.map((c) => (
            <div
              key={c.sha}
              className="p-3 hover:bg-slate-900/60 transition flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-purple-300 shrink-0 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                  {c.sha}
                </span>
                <span className="text-slate-200 truncate">{c.message}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-slate-500 text-[11px]">
                <span>{c.author}</span>
                {c.html_url && (
                  <a
                    href={c.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-white"
                    title="Открыть на GitHub"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
