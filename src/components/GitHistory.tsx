import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import {
  GitBranch,
  GitCommit as GitCommitIcon,
  RotateCcw,
  Eye,
  FileCode,
  Calendar,
  User,
  Github,
  Cloud,
  Copy,
  Check,
  Code2,
  FileSpreadsheet,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { GitCommit } from '../types';
import { loadCommits, computeProjectDiff, ProjectDiff } from '../services/gitService';
import { downloadProjectAsZip, updateAppsScriptProject } from '../services/appsScriptService';

export const GitHistory: React.FC = () => {
  const allProjects = useAppStore((s) => s.allProjects);
  const currentProject = useAppStore((s) => s.currentProject);
  const onSelectProject = useAppStore((s) => s.selectProject);
  const onRestoreVersion = useAppStore((s) => s.restoreVersion);
  const accessToken = useAppStore((s) => s.accessToken);
  const lang = useAppStore((s) => s.lang);
  const addLog = useAppStore((s) => s.addLog);
  const onLog = (msg: string, type?: 'info' | 'success' | 'warning' | 'error') =>
    addLog(msg, type ?? 'info', 'git');
  // Script selector
  const [selectedScriptId, setSelectedScriptId] = useState(
    currentProject?.scriptId ?? allProjects[0]?.scriptId ?? ''
  );
  const activeScript = allProjects.find((p) => p.scriptId === selectedScriptId) ?? currentProject;

  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [diffData, setDiffData] = useState<ProjectDiff | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  // Rollback state
  const [commitToRollback, setCommitToRollback] = useState<GitCommit | null>(null);
  const [deployRemotelyOnRollback, setDeployRemotelyOnRollback] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Copy SHA feedback
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const t = {
    ru: {
      title: 'Система контроля версий Git',
      subtitle:
        'Просмотр истории коммитов для каждого скрипта, автора, даты, сообщений и функции отката',
      scriptSelectorLabel: 'Выберите скрипт для просмотра истории:',
      branch: 'Ветка:',
      noCommits: 'Для выбранного скрипта пока нет истории коммитов.',
      noCommitsDesc:
        'Коммиты формируются автоматически при авто-синхронизации или при ручной фиксации изменений.',
      filesChanged: 'файлов изменено',
      additions: 'добавлено',
      deletions: 'удалено',
      syncedDrive: 'Google Диск',
      syncedGH: 'GitHub',
      viewDiff: 'Посмотреть изменения (Diff)',
      downloadZip: 'Скачать ZIP снимка',
      rollbackBtn: 'Откатить к этому коммиту',
      rollbackTitle: 'Откат версии кода к выбранному коммиту',
      rollbackDesc: (commitId: string, msg: string) =>
        `Вы собираетесь вернуть проект к коммиту ${commitId} ("${msg}"). Текущие файлы рабочего пространства будут заменены состоянием из этого коммита.`,
      deployCheckbox: 'Также немедленно развернуть (перезаписать) в Google Apps Script',
      deployNotice:
        'Внимание: перезапись кода в Google Apps Script обновит скрипт на серверах Google!',
      confirmRollbackAction: 'Подтвердить откат',
      cancel: 'Отмена',
      diffModalTitle: 'Сравнение изменений с предыдущей версией',
      close: 'Закрыть',
      authorLabel: 'Автор:',
      dateLabel: 'Дата и время:',
      messageLabel: 'Сообщение:',
      shaLabel: 'SHA:',
      headBadge: 'HEAD (Текущая версия)',
      filesInCommit: 'Файлы в этом коммите:'
    },
    en: {
      title: 'Git Version Control System',
      subtitle:
        'Inspect commit history per script including author, timestamp, message, and rollback',
      scriptSelectorLabel: 'Select script to view commit history:',
      branch: 'Branch:',
      noCommits: 'No commits found for the selected script yet.',
      noCommitsDesc:
        'Commits are recorded automatically during auto-sync or when creating manual snapshots.',
      filesChanged: 'files changed',
      additions: 'additions',
      deletions: 'deletions',
      syncedDrive: 'Google Drive',
      syncedGH: 'GitHub',
      viewDiff: 'Inspect Diff',
      downloadZip: 'Download ZIP snapshot',
      rollbackBtn: 'Rollback to this commit',
      rollbackTitle: 'Rollback Code Version to Selected Commit',
      rollbackDesc: (commitId: string, msg: string) =>
        `You are about to revert the project back to commit ${commitId} ("${msg}"). Workspace files will be overwritten with this snapshot.`,
      deployCheckbox: 'Also immediately deploy (overwrite) to Google Apps Script remotely',
      deployNotice:
        'Caution: overwriting code in Google Apps Script updates code directly on Google servers!',
      confirmRollbackAction: 'Confirm Rollback',
      cancel: 'Cancel',
      diffModalTitle: 'Changes Diff against parent commit',
      close: 'Close',
      authorLabel: 'Author:',
      dateLabel: 'Timestamp:',
      messageLabel: 'Message:',
      shaLabel: 'SHA:',
      headBadge: 'HEAD (Current Version)',
      filesInCommit: 'Files in this commit:'
    }
  }[lang];

  // Refresh commits when active script changes
  const refreshCommits = async () => {
    if (!activeScript) {
      setCommits([]);
      return;
    }
    const list = await loadCommits(activeScript.scriptId);
    setCommits(list);
  };

  useEffect(() => {
    if (currentProject) {
      setSelectedScriptId(currentProject.scriptId);
    }
  }, [currentProject?.scriptId]);

  useEffect(() => {
    void refreshCommits();
  }, [selectedScriptId, activeScript?.lastModified]);

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const handleOpenDiff = (commit: GitCommit) => {
    setSelectedCommit(commit);
    const parent = commits.find((c) => c.id === commit.parentId);
    const baseFiles = parent ? parent.files : [];
    const diff = computeProjectDiff(baseFiles, commit.files);
    setDiffData(diff);
    setShowDiffModal(true);
  };

  const handleExecuteRollback = async () => {
    if (!commitToRollback || !activeScript) return;
    setIsRollingBack(true);

    try {
      const rollbackMsg = `Rollback: revert to commit ${commitToRollback.id} ("${commitToRollback.message}")`;

      // 1. Local Git Rollback & Workspace Update
      onRestoreVersion(commitToRollback.files, rollbackMsg, deployRemotelyOnRollback);

      // 2. If requested, deploy directly to live Google Apps Script
      if (deployRemotelyOnRollback && accessToken && !activeScript.scriptId.startsWith('1DEMO_')) {
        onLog(
          `Развертывание восстановленной версии в Google Apps Script (${activeScript.scriptId})...`,
          'info'
        );
        await updateAppsScriptProject(activeScript.scriptId, commitToRollback.files, accessToken);
        onLog(`Код успешно обновлен на серверах Google Apps Script!`, 'success');
      }

      onLog(`Откат к коммиту ${commitToRollback.id} успешно выполнен!`, 'success');
      setCommitToRollback(null);
      refreshCommits();
    } catch (err: any) {
      onLog(`Ошибка отката: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setIsRollingBack(false);
    }
  };

  // Display-only timestamp: refreshed whenever the commit list changes
  // eslint-disable-next-line react-hooks/purity -- relative-time label is render-time cosmetics
  const now = useMemo(() => Date.now(), [commits]);

  const formatRelativeTime = (timestamp: number, nowMs: number) => {
    const diffSeconds = Math.floor((nowMs - timestamp) / 1000);
    if (diffSeconds < 60) return `${diffSeconds} сек. назад`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} мин. назад`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ч. назад`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} дн. назад`;
  };

  if (!activeScript) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 shadow-xl text-center">
        <h2 className="text-lg font-bold text-white">
          {lang === 'ru' ? 'Нет подключённых проектов' : 'No connected projects'}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {lang === 'ru'
            ? 'Подключите проект во вкладке «Таблицы», чтобы увидеть историю версий.'
            : 'Connect a project in the “Sheets” tab to see version history.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Script Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <GitBranch className="w-6 h-6 text-purple-400" />
              {t.title}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
          </div>

          {/* Script Selector Dropdown */}
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 block">
                {t.scriptSelectorLabel}
              </label>
              <select
                value={selectedScriptId}
                onChange={(e) => {
                  setSelectedScriptId(e.target.value);
                  const found = allProjects.find((p) => p.scriptId === e.target.value);
                  if (found) onSelectProject(found);
                }}
                className="px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-semibold focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {allProjects.map((p) => (
                  <option key={p.scriptId} value={p.scriptId}>
                    {p.title} {p.parentTitle ? `(${p.parentTitle})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Script Metadata Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span>{activeScript.title}</span>
            </span>

            {activeScript.parentTitle && (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{activeScript.parentTitle}</span>
              </span>
            )}

            <span className="font-mono text-slate-400">
              ID: {activeScript.scriptId.slice(0, 16)}...
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">{t.branch}</span>
            <span className="font-mono font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
              main
            </span>
            <span className="text-slate-400 font-mono">({commits.length} коммитов)</span>
          </div>
        </div>
      </div>

      {/* Commit History Timeline */}
      {commits.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-xl space-y-3">
          <GitCommitIcon className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-300">{t.noCommits}</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">{t.noCommitsDesc}</p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 before:content-[''] before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-800 space-y-4">
          {commits.map((commit, idx) => {
            const isHead = idx === 0;

            return (
              <div
                key={commit.id}
                className={`relative bg-slate-900 border rounded-2xl p-5 shadow-xl transition space-y-3.5 ${
                  isHead
                    ? 'border-purple-500/40 ring-1 ring-purple-500/20'
                    : 'border-slate-800 hover:border-slate-700/80'
                }`}
              >
                {/* Node circle on timeline */}
                <div
                  className={`absolute -left-[31px] sm:-left-[39px] top-5 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    isHead
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  <GitCommitIcon className="w-3.5 h-3.5" />
                </div>

                {/* Commit Header with Author & Date */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* SHA pill with copy */}
                    <button
                      type="button"
                      onClick={() => handleCopySha(commit.id)}
                      title="Копировать SHA коммита"
                      className="group font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>{commit.id}</span>
                      {copiedSha === commit.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>

                    {isHead && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {t.headBadge}
                      </span>
                    )}

                    <h4 className="text-sm font-bold text-white tracking-tight">
                      {commit.message}
                    </h4>
                  </div>

                  {/* Metadata: Author & Timestamp */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <User className="w-3.5 h-3.5 text-purple-400" />
                      <b>{commit.author}</b>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span
                      className="flex items-center gap-1.5"
                      title={new Date(commit.timestamp).toISOString()}
                    >
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(commit.timestamp).toLocaleString()}</span>
                      <span className="text-[11px] text-slate-500">
                        ({formatRelativeTime(commit.timestamp, now)})
                      </span>
                    </span>
                  </div>
                </div>

                {/* Files in Commit List */}
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
                  <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                    {t.filesInCommit}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {commit.files.map((file) => (
                      <span
                        key={file.name}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-1"
                      >
                        {file.type === 'JSON' ? (
                          <FileText className="w-3 h-3 text-amber-400" />
                        ) : (
                          <FileCode className="w-3 h-3 text-indigo-400" />
                        )}
                        <span>{file.name}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions & Stats Bottom Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center gap-3">
                    {commit.summary && (
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-slate-400">
                          {commit.summary.filesChanged} {t.filesChanged}
                        </span>
                        <span className="text-emerald-400 flex items-center font-bold">
                          +{commit.summary.additions}
                        </span>
                        <span className="text-red-400 flex items-center font-bold">
                          -{commit.summary.deletions}
                        </span>
                      </div>
                    )}

                    {commit.syncedToDrive && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        <Cloud className="w-3 h-3" />
                        {t.syncedDrive}
                      </span>
                    )}

                    {commit.syncedToGitHub && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                        <Github className="w-3 h-3" />
                        {t.syncedGH}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDiff(commit)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.viewDiff}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        downloadProjectAsZip(
                          {
                            ...activeScript,
                            files: commit.files,
                            title: `${activeScript.title}_commit_${commit.id}`
                          },
                          `${activeScript.title}_commit_${commit.id}.zip`
                        );
                        onLog(`Скачан снимок коммита ${commit.id}`, 'info');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>ZIP</span>
                    </button>

                    {/* ROLLBACK BUTTON */}
                    <button
                      type="button"
                      onClick={() => setCommitToRollback(commit)}
                      disabled={isHead}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isHead
                          ? 'bg-slate-800/40 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t.rollbackBtn}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diff Modal */}
      {showDiffModal && selectedCommit && diffData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col text-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-400" />
                  {t.diffModalTitle}
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    {selectedCommit.id}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">{selectedCommit.message}</p>
              </div>

              <button
                type="button"
                onClick={() => setShowDiffModal(false)}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
              >
                {t.close}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {diffData.files.map((fileDiff) => (
                <div
                  key={fileDiff.fileName}
                  className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-inner font-mono text-xs"
                >
                  <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">{fileDiff.fileName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">+{fileDiff.additions}</span>
                      <span className="text-red-400 font-bold">-{fileDiff.deletions}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold bg-slate-800 text-slate-400">
                        {fileDiff.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 space-y-0.5 max-h-72 overflow-y-auto leading-5">
                    {fileDiff.lines.length === 0 ? (
                      <div className="p-4 text-slate-500 italic text-center">Нет изменений</div>
                    ) : (
                      fileDiff.lines.map((line, lIdx) => (
                        <div
                          key={lIdx}
                          className={`flex items-start px-2 py-0.5 rounded ${
                            line.type === 'add'
                              ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500'
                              : line.type === 'del'
                                ? 'bg-red-950/40 text-red-300 border-l-2 border-red-500'
                                : 'text-slate-400'
                          }`}
                        >
                          <span className="w-8 shrink-0 select-none text-slate-600 text-right pr-2">
                            {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                          </span>
                          <span className="whitespace-pre-wrap break-all flex-1">
                            {line.content}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {commitToRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white tracking-tight">{t.rollbackTitle}</h3>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  {t.rollbackDesc(commitToRollback.id, commitToRollback.message)}
                </p>
              </div>
            </div>

            {/* Commit details card */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>{t.shaLabel}</span>
                <span className="text-purple-300 font-bold">{commitToRollback.id}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>{t.authorLabel}</span>
                <span className="text-slate-200">{commitToRollback.author}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>{t.dateLabel}</span>
                <span className="text-slate-200">
                  {new Date(commitToRollback.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="pt-1 border-t border-slate-800 text-slate-300 flex items-center justify-between">
                <span>Восстанавливаемых файлов:</span>
                <span className="font-bold text-white">{commitToRollback.files.length}</span>
              </div>
            </div>

            {/* Option to deploy to Google Apps Script remotely */}
            <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deployRemotelyOnRollback}
                  onChange={(e) => setDeployRemotelyOnRollback(e.target.checked)}
                  className="mt-0.5 rounded bg-slate-900 border-indigo-500 text-indigo-600 focus:ring-0"
                />
                <span className="text-xs font-semibold text-slate-200">{t.deployCheckbox}</span>
              </label>
              {deployRemotelyOnRollback && (
                <div className="text-[11px] text-amber-400 flex items-start gap-1.5 pl-6">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{t.deployNotice}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCommitToRollback(null)}
                disabled={isRollingBack}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleExecuteRollback}
                disabled={isRollingBack}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/30 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRollingBack ? 'animate-spin' : ''}`} />
                <span>{isRollingBack ? 'Выполняется откат...' : t.confirmRollbackAction}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
