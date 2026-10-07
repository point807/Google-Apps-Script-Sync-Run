/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { GitMerge, User, Cloud } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';
import { computeLineDiff } from '../services/gitService';
import { ScriptFile } from '../types';

const fileByName = (files: ScriptFile[], name: string): ScriptFile | undefined =>
  files.find((f) => f.name === name);

/**
 * Blocking modal shown when sync finds a file changed both locally and in
 * Apps Script. The user picks which side wins for the conflicted files;
 * everything else is merged automatically.
 */
export const SyncConflictModal: React.FC = () => {
  const syncConflict = useAppStore((s) => s.syncConflict);
  const resolveSyncConflict = useAppStore((s) => s.resolveSyncConflict);
  const t = useT('conflict');

  if (!syncConflict) return null;

  const { localProject, remoteProject, conflictedFiles } = syncConflict;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-start gap-3">
          <GitMerge className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-white">{t.title}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {t.desc} <span className="text-amber-300 font-semibold">{localProject.title}</span>
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="text-xs font-semibold text-slate-300">
            {t.filesLabel}{' '}
            <span className="font-mono text-amber-300">{conflictedFiles.join(', ')}</span>
          </div>

          {conflictedFiles.map((name) => {
            const localFile = fileByName(localProject.files, name);
            const remoteFile = fileByName(remoteProject.files, name);
            const diff = computeLineDiff(localFile?.source ?? '', remoteFile?.source ?? '');
            return (
              <div
                key={name}
                className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60"
              >
                <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white">{name}</span>
                  <span className="text-[10px] text-slate-500">
                    {localFile && !remoteFile
                      ? t.deletedRemotely
                      : !localFile && remoteFile
                        ? t.deletedLocally
                        : t.modifiedBoth}
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto p-3 space-y-0.5 font-mono text-[11px]">
                  {diff.map((line, i) => (
                    <div
                      key={i}
                      className={`leading-relaxed px-1.5 rounded ${
                        line.type === 'add'
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : line.type === 'del'
                            ? 'bg-rose-500/10 text-rose-300'
                            : 'text-slate-500'
                      }`}
                    >
                      <span className="select-none mr-2 opacity-60">
                        {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                      </span>
                      {line.content}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-slate-800 flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={() => resolveSyncConflict('local')}
            className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer flex items-center gap-2"
          >
            <User className="w-3.5 h-3.5" />
            {t.keepLocal}
          </button>
          <button
            type="button"
            onClick={() => resolveSyncConflict('remote')}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition cursor-pointer flex items-center gap-2"
          >
            <Cloud className="w-3.5 h-3.5" />
            {t.takeRemote}
          </button>
        </div>
      </div>
    </div>
  );
};
