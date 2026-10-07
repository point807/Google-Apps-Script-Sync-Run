import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { RunToolbar } from './RunToolbar';
import { ExecutionConsole } from './ExecutionConsole';
import { ProjectToolbar } from './ProjectToolbar';
import { FileTabs } from './FileTabs';
import { DeploymentManager } from './DeploymentManager';
import {
  Code2,
  FileCode,
  FilePlus,
  UploadCloud,
  GitCommit as GitCommitIcon,
  Info,
  ShieldCheck,
  X,
  FileCheck,
  RefreshCw,
  Play,
  Terminal,
  Github
} from 'lucide-react';
import { ScriptFile } from '../types';
import {
  downloadProjectAsZip,
  updateAppsScriptProject,
  fetchAppsScriptProject,
  runAppsScriptFunction,
  extractFunctionsFromCode,
  extractAllScriptFunctions,
  FunctionRunResult
} from '../services/appsScriptService';
import { pushFilesToGitHub } from '../services/githubService';
import { createCommit, computeProjectDiff } from '../services/gitService';
import { SyntaxEditor } from './SyntaxEditor';
import { useT } from '../i18n';

export const CodeWorkspace: React.FC = () => {
  // rendered only when a project is selected (see App shell)
  const project = useAppStore((s) => s.currentProject)!;
  const onUpdateProject = useAppStore((s) => s.updateProject);
  const accessToken = useAppStore((s) => s.accessToken);
  const gitHubConfig = useAppStore((s) => s.gitHubConfig);
  const onUpdateGitHubConfig = useAppStore((s) => s.updateGitHubConfig);
  const activeFileName = useAppStore((s) => s.activeFileName);
  const setActiveFileName = useAppStore((s) => s.setActiveFileName);
  const lang = useAppStore((s) => s.lang);
  const addLog = useAppStore((s) => s.addLog);
  const onLog = (msg: string, type?: 'info' | 'success' | 'warning' | 'error') =>
    addLog(msg, type ?? 'info', 'apps_script');
  const onCommitCreated = () => addLog('Коммит зафиксирован вручную', 'success', 'git');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [showDeployments, setShowDeployments] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'SERVER_JS' | 'HTML'>('SERVER_JS');

  // Push confirmation & sync modal (Google)
  const [showPushConfirm, setShowPushConfirm] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [safeSyncCheck, setSafeSyncCheck] = useState(true);

  // GitHub Save Modal & State
  const [showGitHubSaveModal, setShowGitHubSaveModal] = useState(false);
  const [githubFolderPath, setGithubFolderPath] = useState<string>(
    gitHubConfig?.path || project.parentTitle || project.title || ''
  );
  const [githubCommitMsg, setGithubCommitMsg] = useState<string>('');
  const [isPushingGitHub, setIsPushingGitHub] = useState(false);
  const [isSavingEverywhere, setIsSavingEverywhere] = useState(false);

  // Script Runner & Testing State
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [isRunningFunction, setIsRunningFunction] = useState(false);
  const [runResult, setRunResult] = useState<FunctionRunResult | null>(null);
  const [showRunConsole, setShowRunConsole] = useState(false);

  // Commit modal
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  // Baseline files to track local diffs
  const [baselineFiles, setBaselineFiles] = useState<ScriptFile[]>(project.files);
  const [lastScriptId, setLastScriptId] = useState(project.scriptId);

  useEffect(() => {
    if (project.scriptId !== lastScriptId) {
      setLastScriptId(project.scriptId);
      setBaselineFiles(project.files);
      setSelectedFileIndex(0);
    }
  }, [project.scriptId, lastScriptId, project.files]);

  // Jump to file requested by global search
  useEffect(() => {
    if (!activeFileName) return;
    const idx = project.files.findIndex((f) => f.name === activeFileName);
    if (idx !== -1) {
      setSelectedFileIndex(idx);
      setActiveFileName(null);
    }
  }, [activeFileName, project.files, setActiveFileName]);

  // Compute live diff against baseline
  const projectDiff = computeProjectDiff(baselineFiles, project.files);
  const modifiedFiles = projectDiff.files.filter((f) => f.status === 'modified');
  const addedFiles = projectDiff.files.filter((f) => f.status === 'added');
  const deletedFiles = projectDiff.files.filter((f) => f.status === 'deleted');
  const unchangedFiles = projectDiff.files.filter((f) => f.status === 'unchanged');
  const totalChangedCount = modifiedFiles.length + addedFiles.length + deletedFiles.length;

  const currentFile: ScriptFile | undefined = project.files[selectedFileIndex] || project.files[0];

  const t = useT('code');

  const handleSourceChange = (newSource: string) => {
    const updatedFiles = [...project.files];
    if (updatedFiles[selectedFileIndex]) {
      updatedFiles[selectedFileIndex] = {
        ...updatedFiles[selectedFileIndex],
        source: newSource
      };
      onUpdateProject({
        ...project,
        files: updatedFiles,
        lastModified: new Date().toISOString()
      });
    }
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const cleanName = newFileName.trim().replace(/\.(gs|js|html|json)$/i, '');
    const exists = project.files.some((f) => f.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      alert('Файл с таким именем уже существует!');
      return;
    }

    const newFile: ScriptFile = {
      name: cleanName,
      type: newFileType,
      source:
        newFileType === 'SERVER_JS'
          ? `/**\n * ${cleanName}.gs\n */\nfunction ${cleanName.toLowerCase()}Init() {\n  Logger.log('Module ${cleanName} initialized.');\n}\n`
          : `<!DOCTYPE html>\n<html>\n  <head>\n    <base target="_top">\n  </head>\n  <body>\n    <h3>${cleanName} UI</h3>\n  </body>\n</html>\n`
    };

    const updated = {
      ...project,
      files: [...project.files, newFile]
    };

    onUpdateProject(updated);
    setSelectedFileIndex(updated.files.length - 1);
    setNewFileName('');
    setShowAddFileModal(false);
    onLog(`Создан файл: ${cleanName}`, 'info');
  };

  const handleDeleteFile = (index: number) => {
    if (project.files.length <= 1) {
      alert('В проекте должен оставаться хотя бы один файл.');
      return;
    }
    const file = project.files[index];
    if (!window.confirm(`Удалить файл "${file.name}" из проекта?`)) return;

    const updatedFiles = project.files.filter((_, i) => i !== index);
    onUpdateProject({ ...project, files: updatedFiles });
    setSelectedFileIndex(Math.max(0, index - 1));
    onLog(`Файл ${file.name} удален из проекта`, 'warning');
  };

  const handleAutoDraftCommit = async (reason: string) => {
    try {
      const msg = `Draft ${reason}: ${project.title} @ ${new Date().toLocaleTimeString()}`;
      await createCommit(project.scriptId, project.files, msg, 'Auto Draft', 'main', { force: true });
      addLog(`Автосохранён черновик перед ${reason}`, 'info', 'git');
    } catch {
      // draft failure is non-blocking
    }
  };

  const handleConfirmPush = async () => {
    if (!accessToken) {
      alert('Необходимо выполнить вход через Google для отправки в Apps Script API.');
      return;
    }

    setIsPushing(true);
    await handleAutoDraftCommit('пушем в Google');
    try {
      let finalFilesToSend = [...project.files];

      // Safe sync: if enabled, fetch remote project and preserve remote untouched files
      if (safeSyncCheck) {
        onLog(
          `Безопасная проверка актуальной версии в Google Apps Script (${project.scriptId})...`,
          'info'
        );
        try {
          const remote = await fetchAppsScriptProject(project.scriptId, accessToken);
          const localModifiedMap = new Map(modifiedFiles.map((m) => [m.fileName, true]));

          const mergedFiles: ScriptFile[] = [];

          // Keep remote files, updating only those modified locally
          for (const rf of remote.files) {
            const localFile = project.files.find((lf) => lf.name === rf.name);
            if (localFile && localModifiedMap.has(rf.name)) {
              mergedFiles.push(localFile);
            } else if (localFile && !deletedFiles.some((d) => d.fileName === rf.name)) {
              mergedFiles.push(rf);
            } else if (!localFile && !deletedFiles.some((d) => d.fileName === rf.name)) {
              mergedFiles.push(rf);
            }
          }

          // Add locally created new files
          for (const af of addedFiles) {
            const localFile = project.files.find((lf) => lf.name === af.fileName);
            if (localFile && !mergedFiles.some((mf) => mf.name === localFile.name)) {
              mergedFiles.push(localFile);
            }
          }

          if (mergedFiles.length > 0) {
            finalFilesToSend = mergedFiles;
          }
        } catch (fetchErr) {
          console.warn(
            'Could not fetch remote for safe merge, proceeding with current snapshot:',
            fetchErr
          );
        }
      }

      const modCount = modifiedFiles.length + addedFiles.length;
      onLog(
        `Отправка изменений в Google Apps Script (${modCount} измененных файлов, ${unchangedFiles.length} неизмененных)...`,
        'info'
      );

      await updateAppsScriptProject(project.scriptId, finalFilesToSend, accessToken);

      // Update baseline to reflect fresh synchronized state
      setBaselineFiles(finalFilesToSend);
      onUpdateProject({
        ...project,
        files: finalFilesToSend
      });

      onLog(
        `Код успешно синхронизирован в Apps Script! Изменено файлов: ${modCount}, сохранено без изменений: ${unchangedFiles.length}`,
        'success'
      );

      setShowPushConfirm(false);
      alert(
        `Синхронизация с Google Apps Script успешно завершена!\n\n` +
          `• Изменено файлов: ${modCount}\n` +
          `• Сохранено без изменений: ${unchangedFiles.length}\n` +
          `• Все изменения сохранены в вашем проекте Google.`
      );
    } catch (err: any) {
      onLog(`Ошибка обновления Apps Script: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setIsPushing(false);
    }
  };

  const handleCreateManualCommit = async () => {
    const msg = commitMessage.trim() || `Manual snapshot of ${project.title}`;
    const commit = await createCommit(
      project.scriptId,
      project.files,
      msg,
      'User Developer',
      'main',
      {
        force: true
      }
    );
    if (commit) {
      setBaselineFiles(project.files);
      onLog(`Создан коммит ${commit.id}: ${commit.message}`, 'success');
      if (onCommitCreated) onCommitCreated();
    }
    setShowCommitModal(false);
    setCommitMessage('');
  };

  // Extract functions for the currently active file being viewed/edited
  const currentFileFunctions = useMemo(() => {
    if (!currentFile) return [];
    return extractFunctionsFromCode(currentFile.source || '', currentFile.name);
  }, [currentFile?.source, currentFile?.name]);

  // Extract functions from all files
  const allProjectFunctions = useMemo(() => {
    return extractAllScriptFunctions(project.files);
  }, [project.files]);

  const otherFilesFunctions = useMemo(() => {
    if (!currentFile) return allProjectFunctions;
    return allProjectFunctions.filter((f) => f.fileName !== currentFile.name);
  }, [allProjectFunctions, currentFile?.name]);

  // Automatically update selected function when current file changes
  useEffect(() => {
    if (currentFileFunctions.length > 0) {
      setSelectedFunction(currentFileFunctions[0].name);
    } else if (otherFilesFunctions.length > 0) {
      setSelectedFunction(otherFilesFunctions[0].name);
    }
  }, [selectedFileIndex, currentFile?.name, currentFileFunctions.length]);

  // Keep githubFolderPath in sync if project changes
  useEffect(() => {
    setGithubFolderPath(gitHubConfig?.path || project.parentTitle || project.title || '');
  }, [project.parentTitle, project.title, gitHubConfig?.path]);

  // Execute / Test script function
  const handleExecuteFunction = async () => {
    if (!selectedFunction) return;
    setIsRunningFunction(true);
    setRunResult(null);
    setShowRunConsole(true);
    try {
      const originFile = currentFileFunctions.some((f) => f.name === selectedFunction)
        ? currentFile?.name
        : otherFilesFunctions.find((f) => f.name === selectedFunction)?.fileName ||
          currentFile?.name;
      onLog(`Запуск функции "${selectedFunction}()" из файла ${originFile}...`, 'info');
      const result = await runAppsScriptFunction(
        project.scriptId,
        selectedFunction,
        [],
        accessToken,
        project.files
      );
      setRunResult(result);
      if (result.status === 'success') {
        onLog(
          `Функция "${selectedFunction}()" [${originFile}] успешно выполнена (${result.durationMs}ms)`,
          'success'
        );
      } else {
        onLog(`Ошибка выполнения "${selectedFunction}()": ${result.error}`, 'error');
      }
    } catch (e: any) {
      setRunResult({
        status: 'error',
        error: e.message || String(e),
        logs: [],
        durationMs: 0,
        source: 'local_runner'
      });
      onLog(`Ошибка выполнения: ${e.message}`, 'error');
    } finally {
      setIsRunningFunction(false);
    }
  };

  // Save to GitHub in a dedicated folder
  const handleSaveToGitHub = async (customFolder?: string, customMessage?: string) => {
    if (!gitHubConfig || !gitHubConfig.token || !gitHubConfig.owner || !gitHubConfig.repo) {
      alert(
        'GitHub не подключен или не выбран репозиторий. Пожалуйста, откройте вкладку GitHub и подключите аккаунт.'
      );
      return;
    }

    await handleAutoDraftCommit('пушем в GitHub');

    const folder =
      customFolder !== undefined
        ? customFolder
        : githubFolderPath || project.parentTitle || project.title || '';
    const cleanFolder = folder.replace(/[\\/:*?"<>|]/g, '_').trim();
    const msg =
      customMessage ||
      githubCommitMsg.trim() ||
      `Update ${project.title} (${project.parentTitle ? 'Table: ' + project.parentTitle : 'Google Sheets'}) [ScriptVault]`;

    setIsPushingGitHub(true);
    try {
      onLog(
        `Отправка файлов проекта "${project.title}" в GitHub (${gitHubConfig.owner}/${gitHubConfig.repo}, папка: "${cleanFolder || '/'}")`,
        'info'
      );
      const res = await pushFilesToGitHub(
        gitHubConfig.token,
        gitHubConfig.owner,
        gitHubConfig.repo,
        gitHubConfig.branch || 'main',
        project.files,
        msg,
        cleanFolder
      );

      // Save folder path into gitHubConfig if changed
      if (onUpdateGitHubConfig && cleanFolder !== gitHubConfig.path) {
        onUpdateGitHubConfig({
          ...gitHubConfig,
          path: cleanFolder
        });
      }

      onLog(
        `Успешно сохранено на GitHub в папку "${cleanFolder || '/'}"! Коммит: ${res.commitSha.slice(0, 7)}`,
        'success'
      );
      setShowGitHubSaveModal(false);
      alert(
        `Скрипты успешно сохранены в репозиторий GitHub!\n\n• Папка: ${cleanFolder || 'корень репозитория'}\n• Ветка: ${gitHubConfig.branch || 'main'}\n• Коммит: ${res.commitSha.slice(0, 7)}`
      );
    } catch (err: any) {
      onLog(`Ошибка сохранения на GitHub: ${err.message}`, 'error');
      alert(`Ошибка сохранения на GitHub: ${err.message}`);
    } finally {
      setIsPushingGitHub(false);
    }
  };

  // Save everywhere: Google Apps Script + GitHub
  const handleSaveEverywhere = async () => {
    setIsSavingEverywhere(true);
    try {
      // 1. Save to Google
      await handleConfirmPush();

      // 2. Save to GitHub
      if (gitHubConfig?.token && gitHubConfig?.owner && gitHubConfig?.repo) {
        const folder = (githubFolderPath || project.parentTitle || project.title || '')
          .replace(/[\\/:*?"<>|]/g, '_')
          .trim();
        await handleSaveToGitHub(
          folder,
          `Save all: ${project.title} (${project.parentTitle || 'Google Sheets'})`
        );
      } else {
        onLog(
          'Сохранено в Google! (GitHub не подключен — для сохранения в GitHub подключите его на вкладке GitHub)',
          'info'
        );
      }
    } finally {
      setIsSavingEverywhere(false);
    }
  };

  return (
    <div className="space-y-4">
      <ProjectToolbar
        project={project}
        totalChangedCount={totalChangedCount}
        boundToLabel={t.boundTo}
        isPushing={isPushing}
        isSavingEverywhere={isSavingEverywhere}
        onPushToGoogle={() => setShowPushConfirm(true)}
        onSaveToGitHub={() => {
          if (!gitHubConfig?.connected) {
            alert('Сначала подключите GitHub на вкладке "GitHub".');
            return;
          }
          setShowGitHubSaveModal(true);
        }}
        onSaveEverywhere={handleSaveEverywhere}
        onCreateCommit={() => setShowCommitModal(true)}
        onDownloadZip={() => {
          downloadProjectAsZip(project);
          onLog(`Скачан ZIP-архив проекта ${project.title}`, 'info');
        }}
      />

      {/* Editor & File Tabs Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <FileTabs
          files={project.files}
          selectedFileIndex={selectedFileIndex}
          onSelectFile={setSelectedFileIndex}
          modifiedFileNames={modifiedFiles.map((m) => m.fileName)}
          addedFileNames={addedFiles.map((a) => a.fileName)}
          onDeleteFile={handleDeleteFile}
          onAddFile={() => setShowAddFileModal(true)}
          currentFile={currentFile}
          scriptId={project.scriptId}
        />

        <RunToolbar
          currentFile={currentFile}
          currentFileFunctions={currentFileFunctions}
          otherFilesFunctions={otherFilesFunctions}
          selectedFunction={selectedFunction}
          setSelectedFunction={setSelectedFunction}
          isRunningFunction={isRunningFunction}
          onExecute={handleExecuteFunction}
          runResult={runResult}
          showRunConsole={showRunConsole}
          onToggleConsole={() => setShowRunConsole(!showRunConsole)}
          onOpenDeployments={() => setShowDeployments(true)}
        />

        {/* Editor Area — explicit viewport height so Monaco always has a
            measurable box (a zero-height parent renders an invisible editor) */}
        <div className="relative bg-slate-950 flex-1 min-h-[280px] h-[55vh] lg:h-[62vh]">
          {currentFile ? (
            <SyntaxEditor file={currentFile} onChange={handleSourceChange} lang={lang} />
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">Нет выбранного файла</div>
          )}
        </div>

        {showRunConsole && runResult && (
          <ExecutionConsole
            currentFile={currentFile}
            selectedFunction={selectedFunction}
            runResult={runResult}
            onClose={() => setShowRunConsole(false)}
          />
        )}
      </div>

      {/* Add File Modal */}
      {showAddFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-slate-200">
            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <FilePlus className="w-5 h-5 text-indigo-400" />
              {t.addFile}
            </h3>

            <form onSubmit={handleCreateFile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Имя файла</label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder={t.fileNamePlaceholder}
                  autoFocus
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Тип файла</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewFileType('SERVER_JS')}
                    className={`px-3 py-2 text-xs font-medium rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      newFileType === 'SERVER_JS'
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>.gs (Скрипт)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewFileType('HTML')}
                    className={`px-3 py-2 text-xs font-medium rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      newFileType === 'HTML'
                        ? 'bg-orange-600/20 text-orange-300 border-orange-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>.html (Интерфейс)</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddFileModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!newFileName.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {t.createFileBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Git Commit Modal */}
      {showCommitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl text-slate-200">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <GitCommitIcon className="w-5 h-5 text-purple-400" />
              {t.commitModalTitle}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Фиксация текущего состояния файлов в локальную систему контроля версий Git.
            </p>

            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={t.commitMessagePlaceholder}
              rows={3}
              autoFocus
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 mb-4 font-mono"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCommitModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleCreateManualCommit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition cursor-pointer"
              >
                {t.createCommitBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Push & Sync Details Modal */}
      {showPushConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Синхронизация с Google Apps Script
                  </h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {project.title} • ID: {project.scriptId}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPushConfirm(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Changes Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Статус файлов перед отправкой:</span>
                <span className="text-slate-400">
                  Всего файлов: <b className="text-white">{project.files.length}</b>
                </span>
              </div>

              {/* Modified Files */}
              {modifiedFiles.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Измененные файлы ({modifiedFiles.length}):
                    </span>
                    <span className="text-[11px] text-amber-400/80">будет обновлен код</span>
                  </div>
                  <div className="divide-y divide-amber-500/15">
                    {modifiedFiles.map((f) => (
                      <div
                        key={f.fileName}
                        className="py-1.5 flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-white font-medium">{f.fileName}</span>
                        <div className="flex items-center gap-2 text-[11px]">
                          {f.additions > 0 && (
                            <span className="text-emerald-400">+{f.additions}</span>
                          )}
                          {f.deletions > 0 && <span className="text-red-400">-{f.deletions}</span>}
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                            изменен
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Added Files */}
              {addedFiles.length > 0 && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                  <span className="font-semibold text-emerald-300 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Новые файлы ({addedFiles.length}):
                  </span>
                  <div className="text-xs font-mono text-emerald-200">
                    {addedFiles.map((f) => f.fileName).join(', ')}
                  </div>
                </div>
              )}

              {/* Unchanged Files */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-slate-400" />
                    Сохраняются без изменений ({unchangedFiles.length}):
                  </span>
                  <span className="text-[11px] text-slate-500">код не менялся</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {unchangedFiles.map((f) => (
                    <span
                      key={f.fileName}
                      className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-slate-900 border border-slate-700/60 text-slate-400"
                    >
                      {f.fileName}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Explanation Note: Why Google requires all files */}
            <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-900/30 text-xs text-blue-200 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-2 font-semibold text-blue-300">
                <Info className="w-4 h-4 shrink-0 text-blue-400" />
                <span>Почему Google API передает все файлы?</span>
              </div>
              <p className="text-[11px] text-slate-300">
                В Google Apps Script REST API используется метод{' '}
                <code className="text-blue-300 font-mono">PUT /projects/.../content</code>, который
                полностью синхронизирует состояние проекта. Если передать только один измененный
                файл, Google сотрет все остальные файлы из проекта. Поэтому неизмененные файлы
                отправляются как есть для сохранения целостности скрипта.
              </p>
            </div>

            {/* Safe Sync Option */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={safeSyncCheck}
                onChange={(e) => setSafeSyncCheck(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-0 focus:outline-none"
              />
              <div className="flex-1">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Безопасное слияние (Safe Merge)
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Перед отправкой проверить удаленные файлы на Google Диске, чтобы не затереть
                  изменения других пользователей в неизмененных файлах.
                </span>
              </div>
            </label>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPushConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmPush}
                disabled={isPushing}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isPushing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Отправка в Google...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>
                      {totalChangedCount > 0
                        ? `Отправить изменения (${totalChangedCount} изм.)`
                        : 'Синхронизировать проект'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Save to GitHub with folder selection */}
      {showGitHubSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-800 text-white">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Сохранить скрипт в GitHub</h3>
                  <p className="text-xs text-slate-400">
                    Репозиторий:{' '}
                    <span className="font-mono text-indigo-400">
                      {gitHubConfig?.owner}/{gitHubConfig?.repo}
                    </span>{' '}
                    ({gitHubConfig?.branch || 'main'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGitHubSaveModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Folder in repo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Папка в репозитории для скрипта этой таблицы:
                </label>
                <input
                  type="text"
                  value={githubFolderPath}
                  onChange={(e) => setGithubFolderPath(e.target.value)}
                  placeholder="например: Таблица_Финансы (или оставьте пустым для корня)"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />

                {/* Preset folder shortcuts */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px]">
                  <span className="text-slate-500">Быстрый выбор:</span>
                  {project.parentTitle && (
                    <button
                      type="button"
                      onClick={() =>
                        setGithubFolderPath(project.parentTitle!.replace(/[\\/:*?"<>|]/g, '_'))
                      }
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition cursor-pointer"
                    >
                      📁 По таблице: {project.parentTitle}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setGithubFolderPath(project.title.replace(/[\\/:*?"<>|]/g, '_'))}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition cursor-pointer"
                  >
                    📁 По скрипту: {project.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGithubFolderPath('')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition cursor-pointer"
                  >
                    Корень (/)
                  </button>
                </div>
              </div>

              {/* Commit Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Сообщение коммита (Git Commit Message):
                </label>
                <input
                  type="text"
                  value={githubCommitMsg}
                  onChange={(e) => setGithubCommitMsg(e.target.value)}
                  placeholder={`Обновление ${project.title} из таблицы ${project.parentTitle || ''}`}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
                <div className="text-slate-300 font-semibold">
                  Файлы к отправке ({project.files.length}):
                </div>
                <div className="font-mono text-indigo-300 truncate">
                  {project.files.map((f) => f.name).join(', ')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowGitHubSaveModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleSaveToGitHub()}
                disabled={isPushingGitHub}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPushingGitHub ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Отправка в GitHub...</span>
                  </>
                ) : (
                  <>
                    <Github className="w-3.5 h-3.5" />
                    <span>Сохранить в папку на GitHub</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Run / Test Apps Script Function */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Play className="w-5 h-5 fill-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Запуск и проверка функций скрипта
                  </h3>
                  <p className="text-xs text-slate-400">
                    Тестируйте функции проекта с просмотром логов Logger.log и возвращаемых значений
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRunModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Function Selector & Execution Trigger */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Выберите функцию для выполнения:
                </label>
                <div className="flex items-center gap-2">
                  {currentFileFunctions.length > 0 || otherFilesFunctions.length > 0 ? (
                    <select
                      value={selectedFunction}
                      onChange={(e) => setSelectedFunction(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                    >
                      {currentFileFunctions.length > 0 && (
                        <optgroup label={`Функции в этом файле (${currentFile?.name})`}>
                          {currentFileFunctions.map((fn) => (
                            <option
                              key={`modal-curr-${fn.name}`}
                              value={fn.name}
                              className="bg-slate-900 text-emerald-300"
                            >
                              ▶ {fn.name}()
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherFilesFunctions.length > 0 && (
                        <optgroup label={`Другие файлы проекта`}>
                          {otherFilesFunctions.map((fn) => (
                            <option
                              key={`modal-other-${fn.fileName}-${fn.name}`}
                              value={fn.name}
                              className="bg-slate-900 text-slate-300"
                            >
                              {fn.name}() [{fn.fileName}]
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={selectedFunction}
                      onChange={(e) => setSelectedFunction(e.target.value)}
                      placeholder="Имя функции (например: myFunction)"
                      className="flex-1 px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  )}

                  <button
                    type="button"
                    onClick={handleExecuteFunction}
                    disabled={isRunningFunction || !selectedFunction}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                  >
                    {isRunningFunction ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Выполнение...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Запустить</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Execution Results Console */}
              {runResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] flex items-center gap-1.5 ${
                          runResult.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            runResult.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        <span>{runResult.status === 'success' ? 'Успешно' : 'Ошибка'}</span>
                      </span>

                      <span className="text-slate-400 font-mono text-[11px]">
                        {runResult.durationMs} ms
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono uppercase">
                      {runResult.source === 'cloud' ? 'Google Cloud API' : 'Apps Script Runner'}
                    </span>
                  </div>

                  {/* Error if present */}
                  {runResult.error && (
                    <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-mono">
                      <div className="font-bold mb-1">Ошибка:</div>
                      <div>{runResult.error}</div>
                    </div>
                  )}

                  {/* Return Value */}
                  {runResult.status === 'success' && (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                      <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                        Возвращенное значение (Return Value):
                      </div>
                      <pre className="text-xs font-mono text-emerald-400 overflow-x-auto m-0">
                        {typeof runResult.result === 'object'
                          ? JSON.stringify(runResult.result, null, 2)
                          : String(runResult.result)}
                      </pre>
                    </div>
                  )}

                  {/* Execution Logs */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-slate-400" />
                        <span>Журнал выполнения (Logger.log):</span>
                      </span>
                      <span className="text-[10px] text-slate-600 font-mono">
                        {runResult.logs.length} строк
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-xs max-h-48 overflow-y-auto">
                      {runResult.logs.map((logLine, idx) => (
                        <div
                          key={idx}
                          className="text-slate-300 leading-relaxed border-l-2 border-slate-700 pl-2"
                        >
                          {logLine}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRunModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      <DeploymentManager open={showDeployments} onClose={() => setShowDeployments(false)} />
    </div>
  );
};
