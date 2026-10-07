/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import {
  Code2,
  Check,
  UploadCloud,
  Github,
  Save,
  GitCommit as GitCommitIcon,
  Archive
} from 'lucide-react';
import { AppsScriptProject } from '../types';

export interface ProjectToolbarProps {
  project: AppsScriptProject;
  totalChangedCount: number;
  boundToLabel: string;
  isPushing: boolean;
  isSavingEverywhere: boolean;
  onPushToGoogle: () => void;
  onSaveToGitHub: () => void;
  onSaveEverywhere: () => void;
  onCreateCommit: () => void;
  onDownloadZip: () => void;
}

/** Workspace banner: project identity, change badges and the five action buttons. */
export const ProjectToolbar: React.FC<ProjectToolbarProps> = ({
  project,
  totalChangedCount,
  boundToLabel,
  isPushing,
  isSavingEverywhere,
  onPushToGoogle,
  onSaveToGitHub,
  onSaveEverywhere,
  onCreateCommit,
  onDownloadZip
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-400" />
            <span>{project.title}</span>
          </h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            ID: {project.scriptId.slice(0, 16)}...
          </span>

          {totalChangedCount > 0 ? (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Изменено: {totalChangedCount} файл(ов)</span>
            </span>
          ) : (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Синхронизировано</span>
            </span>
          )}
        </div>

        {project.parentTitle && (
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span>{boundToLabel}</span>
            <span className="text-emerald-400 font-medium">{project.parentTitle}</span>
          </p>
        )}
      </div>

      {/* Action Buttons: Save to Google, Save to GitHub, Save Everywhere */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 1. Save to Google Apps Script */}
        <button
          type="button"
          onClick={onPushToGoogle}
          className={`px-3 py-1.5 text-xs font-semibold text-white rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer ${
            totalChangedCount > 0
              ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title="Сохранить изменения в Google Apps Script"
        >
          <UploadCloud className="w-3.5 h-3.5 text-indigo-300" />
          <span>В Google</span>
          {totalChangedCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 font-bold rounded-full text-[10px]">
              {totalChangedCount}
            </span>
          )}
        </button>

        {/* 2. Save to GitHub (folder-aware) */}
        <button
          type="button"
          onClick={onSaveToGitHub}
          className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          title="Сохранить скрипт в папку таблицы на GitHub"
        >
          <Github className="w-3.5 h-3.5 text-slate-200" />
          <span>В GitHub</span>
        </button>

        {/* 3. Save Everywhere */}
        <button
          type="button"
          onClick={onSaveEverywhere}
          disabled={isSavingEverywhere || isPushing}
          className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="Сохранить одновременно в Google Apps Script и в репозиторий GitHub"
        >
          <Save className="w-3.5 h-3.5 text-amber-400" />
          <span>{isSavingEverywhere ? 'Сохранение...' : 'Везде'}</span>
        </button>

        {/* 4. Git Commit Snapshot */}
        <button
          type="button"
          onClick={onCreateCommit}
          className="px-2.5 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl transition flex items-center gap-1 cursor-pointer"
          title="Зафиксировать локальный снимок Git"
        >
          <GitCommitIcon className="w-3.5 h-3.5" />
          <span>Git</span>
        </button>

        {/* 5. Download ZIP */}
        <button
          type="button"
          onClick={onDownloadZip}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer"
          title="Скачать ZIP-архив проекта"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
