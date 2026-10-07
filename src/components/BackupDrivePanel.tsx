import React, { useState, useEffect } from 'react';
import {
  Clock,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  FileJson,
  Calendar,
  Layers,
  Folder,
  FolderPlus,
  Search,
  Check,
  Code2,
  FileSpreadsheet,
  Settings2
} from 'lucide-react';
import { AppsScriptProject, DriveBackupSnapshot, DriveFolder, SyncSettings } from '../types';
import {
  getOrCreateBackupFolder,
  listGoogleDriveFolders,
  createCustomDriveFolder,
  listDriveSnapshots,
  downloadDriveFileContent
} from '../services/googleDriveService';

interface BackupDrivePanelProps {
  allProjects: AppsScriptProject[];
  accessToken: string | null;
  settings: SyncSettings;
  onUpdateSettings: (settings: SyncSettings) => void;
  onTriggerBackupNow: () => void;
  isSyncing: boolean;
  lang: 'ru' | 'en';
  onLog: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const BackupDrivePanel: React.FC<BackupDrivePanelProps> = ({
  allProjects,
  accessToken,
  settings,
  onUpdateSettings,
  onTriggerBackupNow,
  isSyncing,
  lang,
  onLog
}) => {
  // Folder selector state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Snapshots state
  const [snapshots, setSnapshots] = useState<DriveBackupSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');

  // Frequency custom input
  const [customSeconds, setCustomSeconds] = useState(settings.intervalSeconds);

  const t = {
    ru: {
      title: 'Настройки синхронизации и Google Диск',
      subtitle: 'Выбор папки на Диске, частота авто-синхронизации и выбор отслеживаемых скриптов',
      folderSection: '1. Папка резервного копирования на Google Диске',
      currentFolder: 'Текущая выбранная папка:',
      changeFolderBtn: 'Выбрать / Изменить папку',
      createNewFolderBtn: 'Создать новую папку',
      frequencySection: '2. Частота автоматической синхронизации',
      autoSyncToggle: 'Автоматическая синхронизация изменений в реальном времени',
      intervalPresetLabel: 'Предустановленные интервалы:',
      customIntervalLabel: 'Или задайте интервал вручную (в секундах):',
      applyInterval: 'Применить',
      scriptsSection: '3. Выбор скриптов для синхронизации',
      scriptsSubtitle:
        'Отметьте скрипты, которые должны автоматически проверяться и сохраняться на Google Диск:',
      selectAll: 'Выбрать все',
      deselectAll: 'Снять все',
      selectedCount: 'Выбрано для синхронизации:',
      backupNowBtn: 'Синхронизировать выбранные скрипты сейчас',
      syncingBtn: 'Синхронизация...',
      snapshotsSection: 'Снимки резервных копий в текущей папке',
      refreshSnapshots: 'Обновить список',
      noSnapshots: 'В выбранной папке пока нет файлов снимков.',
      browseModalTitle: 'Выбор папки на Google Диске',
      folderSearchPlaceholder: 'Поиск папок по названию...',
      selectFolderBtn: 'Выбрать эту папку',
      createFolderTitle: 'Создать новую папку на Диске:',
      folderNamePlaceholder: 'Например, AppsScript_Backups_2026',
      createFolderAction: 'Создать и выбрать',
      close: 'Закрыть',
      noDriveToken: 'Для доступа к Google Диску выполните вход в аккаунт Google в верхней панели.'
    },
    en: {
      title: 'Sync Settings & Google Drive',
      subtitle: 'Folder selection on Drive, frequency configuration, and target script selection',
      folderSection: '1. Google Drive Backup Folder',
      currentFolder: 'Currently selected folder:',
      changeFolderBtn: 'Browse / Change Folder',
      createNewFolderBtn: 'Create New Folder',
      frequencySection: '2. Automatic Synchronization Frequency',
      autoSyncToggle: 'Automatic real-time changes synchronization',
      intervalPresetLabel: 'Preset intervals:',
      customIntervalLabel: 'Or enter custom interval (in seconds):',
      applyInterval: 'Apply',
      scriptsSection: '3. Select Scripts to Synchronize',
      scriptsSubtitle:
        'Check the scripts that should be automatically tracked and backed up to Google Drive:',
      selectAll: 'Select All',
      deselectAll: 'Deselect All',
      selectedCount: 'Selected for sync:',
      backupNowBtn: 'Sync Selected Scripts Now',
      syncingBtn: 'Syncing...',
      snapshotsSection: 'Backup Snapshots in Current Folder',
      refreshSnapshots: 'Refresh Snapshots',
      noSnapshots: 'No snapshot files found in the selected folder yet.',
      browseModalTitle: 'Select Google Drive Folder',
      folderSearchPlaceholder: 'Search folders by name...',
      selectFolderBtn: 'Select this folder',
      createFolderTitle: 'Create New Folder on Drive:',
      folderNamePlaceholder: 'e.g., AppsScript_Backups_2026',
      createFolderAction: 'Create & Select',
      close: 'Close',
      noDriveToken: 'Sign in with Google in the top bar to access Drive folders.'
    }
  }[lang];

  // Load folders when opening folder modal
  const handleOpenFolderModal = async () => {
    setShowFolderModal(true);
    if (!accessToken) return;
    setLoadingFolders(true);
    try {
      const list = await listGoogleDriveFolders(accessToken, folderSearch);
      setDriveFolders(list);
    } catch (e: any) {
      onLog(`Ошибка загрузки папок: ${e.message}`, 'error');
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleSearchFolders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setLoadingFolders(true);
    try {
      const list = await listGoogleDriveFolders(accessToken, folderSearch);
      setDriveFolders(list);
    } catch (e: any) {
      onLog(`Ошибка поиска папок: ${e.message}`, 'error');
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleSelectFolder = (folder: DriveFolder) => {
    onUpdateSettings({
      ...settings,
      backupFolderId: folder.id,
      backupFolderName: folder.name
    });
    setShowFolderModal(false);
    onLog(`Выбрана папка для резервного копирования: ${folder.name} (ID: ${folder.id})`, 'success');
  };

  const handleCreateAndSelectFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const created = await createCustomDriveFolder(accessToken, newFolderName.trim());
      handleSelectFolder(created);
      setNewFolderName('');
    } catch (e: any) {
      onLog(`Ошибка создания папки: ${e.message}`, 'error');
      alert(`Ошибка: ${e.message}`);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Load snapshots from the currently selected folder
  const loadSnapshots = async () => {
    if (!accessToken) return;
    setLoadingSnapshots(true);
    try {
      let folderId = settings.backupFolderId;
      if (!folderId) {
        folderId = await getOrCreateBackupFolder(accessToken, settings.backupFolderName);
        onUpdateSettings({ ...settings, backupFolderId: folderId });
      }
      const list = await listDriveSnapshots(accessToken, folderId);
      setSnapshots(list);
    } catch (e: any) {
      console.warn('Failed to list drive snapshots', e);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadSnapshots();
    }
  }, [accessToken, settings.backupFolderId, settings.backupFolderName]);

  // Script selection helpers
  const isScriptSelected = (scriptId: string) => {
    if (!settings.selectedScriptIds || settings.selectedScriptIds.length === 0) {
      // By default all scripts are selected if not specified
      return true;
    }
    return settings.selectedScriptIds.includes(scriptId);
  };

  const toggleScriptSelection = (scriptId: string) => {
    const currentSelected = settings.selectedScriptIds || allProjects.map((p) => p.scriptId);
    let updated: string[];
    if (currentSelected.includes(scriptId)) {
      updated = currentSelected.filter((id) => id !== scriptId);
    } else {
      updated = [...currentSelected, scriptId];
    }
    onUpdateSettings({
      ...settings,
      selectedScriptIds: updated
    });
  };

  const handleSelectAllScripts = () => {
    onUpdateSettings({
      ...settings,
      selectedScriptIds: allProjects.map((p) => p.scriptId)
    });
  };

  const handleDeselectAllScripts = () => {
    onUpdateSettings({
      ...settings,
      selectedScriptIds: []
    });
  };

  const handleApplyCustomInterval = () => {
    const val = Math.max(5, Math.min(86400, Number(customSeconds) || 30));
    onUpdateSettings({
      ...settings,
      intervalSeconds: val
    });
    onLog(`Интервал синхронизации установлен: ${val} секунд`, 'info');
  };

  const handlePreviewSnapshot = async (snapshot: DriveBackupSnapshot) => {
    if (!accessToken) return;
    try {
      onLog(`Загрузка снимка ${snapshot.fileName} с Google Диска...`, 'info');
      const text = await downloadDriveFileContent(accessToken, snapshot.fileId);
      setPreviewFileName(snapshot.fileName);
      setPreviewContent(text);
    } catch (err: any) {
      onLog(`Ошибка загрузки: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    }
  };

  const selectedCount =
    settings.selectedScriptIds && settings.selectedScriptIds.length > 0
      ? settings.selectedScriptIds.length
      : allProjects.length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Settings2 className="w-6 h-6 text-indigo-400" />
            {t.title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTriggerBackupNow}
            disabled={isSyncing}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? t.syncingBtn : t.backupNowBtn}</span>
          </button>
        </div>
      </div>

      {/* 1. Folder Selection on Google Drive */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <span>{t.folderSection}</span>
          </h3>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenFolderModal}
              className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.changeFolderBtn}</span>
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Folder className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400">{t.currentFolder}</div>
              <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <span>/{settings.backupFolderName}</span>
                {settings.backupFolderId && (
                  <span className="text-[11px] text-slate-500 font-normal">
                    (ID: {settings.backupFolderId.slice(0, 14)}...)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Папка активна для сохранения снимков</span>
          </div>
        </div>
      </div>

      {/* 2. Frequency Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <span>{t.frequencySection}</span>
          </h3>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 text-xs font-mono text-indigo-300">
            <span>Текущий период:</span>
            <span className="font-bold">{settings.intervalSeconds}с</span>
          </div>
        </div>

        {/* Real-time Toggle */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-slate-200">{t.autoSyncToggle}</div>
            <div className="text-xs text-slate-400">
              Периодический опрос изменений кода и автоматическое создание коммитов в Git и Google
              Диск.
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoSyncEnabled}
              onChange={(e) => onUpdateSettings({ ...settings, autoSyncEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
          </label>
        </div>

        {/* Presets Grid */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300 block">
            {t.intervalPresetLabel}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { sec: 10, label: '10 сек (Ультра)' },
              { sec: 30, label: '30 сек (Стандарт)' },
              { sec: 60, label: '1 минута' },
              { sec: 300, label: '5 минут' },
              { sec: 900, label: '15 минут' },
              { sec: 3600, label: '1 час' }
            ].map((preset) => (
              <button
                key={preset.sec}
                type="button"
                onClick={() => {
                  onUpdateSettings({ ...settings, intervalSeconds: preset.sec });
                  setCustomSeconds(preset.sec);
                  onLog(`Интервал синхронизации: ${preset.sec}с`, 'info');
                }}
                className={`py-2 px-3 text-xs rounded-xl font-medium border text-center transition cursor-pointer ${
                  settings.intervalSeconds === preset.sec
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom interval */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="text-xs font-medium text-slate-300">{t.customIntervalLabel}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={86400}
              value={customSeconds}
              onChange={(e) => setCustomSeconds(Number(e.target.value))}
              className="w-28 px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleApplyCustomInterval}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl transition cursor-pointer"
            >
              {t.applyInterval}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Script Selection Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Code2 className="w-5 h-5 text-indigo-400" />
              <span>{t.scriptsSection}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">{t.scriptsSubtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-400 font-mono mr-2">
              {t.selectedCount} <b>{selectedCount}</b> из {allProjects.length}
            </span>
            <button
              type="button"
              onClick={handleSelectAllScripts}
              className="px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
            >
              {t.selectAll}
            </button>
            <button
              type="button"
              onClick={handleDeselectAllScripts}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-950 rounded-lg transition cursor-pointer"
            >
              {t.deselectAll}
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl bg-slate-950/70 overflow-hidden">
          {allProjects.map((project) => {
            const selected = isScriptSelected(project.scriptId);
            return (
              <div
                key={project.scriptId}
                onClick={() => toggleScriptSelection(project.scriptId)}
                className={`p-4 transition flex items-center justify-between gap-4 cursor-pointer ${
                  selected
                    ? 'bg-indigo-950/20 hover:bg-indigo-950/30'
                    : 'hover:bg-slate-900/60 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                      selected
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {project.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {project.files.length} файлов
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      {project.parentTitle && (
                        <span className="flex items-center gap-1 text-emerald-400 truncate">
                          <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                          <span>{project.parentTitle}</span>
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-slate-500 truncate">
                        ID: {project.scriptId.slice(0, 16)}...
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {selected ? (
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />В
                      авто-синхронизации
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                      Отключен
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Stored Snapshots on Google Drive */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>{t.snapshotsSection}</span>
          </h3>

          <button
            type="button"
            onClick={loadSnapshots}
            disabled={loadingSnapshots || !accessToken}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSnapshots ? 'animate-spin' : ''}`} />
            <span>{t.refreshSnapshots}</span>
          </button>
        </div>

        {!accessToken ? (
          <div className="p-8 text-center rounded-xl bg-slate-950/40 text-xs text-slate-400">
            {t.noDriveToken}
          </div>
        ) : loadingSnapshots ? (
          <div className="p-8 text-center rounded-xl bg-slate-950/40 text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Загрузка списка копий с Google Диска...</span>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-950/40 text-xs text-slate-500 font-mono">
            {t.noSnapshots}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl bg-slate-950/60 overflow-hidden font-mono text-xs">
            {snapshots.map((s) => (
              <div
                key={s.fileId}
                className="p-3.5 hover:bg-slate-900/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileJson className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-slate-200 font-semibold truncate">{s.fileName}</span>
                  {s.sizeBytes && (
                    <span className="text-[11px] text-slate-500 shrink-0">
                      ({Math.round(s.sizeBytes / 1024)} KB)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {new Date(s.createdTime).toLocaleString()}
                  </span>

                  <button
                    type="button"
                    onClick={() => handlePreviewSnapshot(s)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-xs"
                  >
                    Просмотр
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Google Drive Folder Picker & Creator */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col text-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Folder className="w-5 h-5 text-emerald-400" />
                <span>{t.browseModalTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
              >
                {t.close}
              </button>
            </div>

            {/* Modal Search & Create Row */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 space-y-3">
              <form onSubmit={handleSearchFolders} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={folderSearch}
                    onChange={(e) => setFolderSearch(e.target.value)}
                    placeholder={t.folderSearchPlaceholder}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingFolders}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  Поиск
                </button>
              </form>

              {/* Create new folder inline */}
              <form
                onSubmit={handleCreateAndSelectFolder}
                className="flex gap-2 pt-2 border-t border-slate-800/60"
              >
                <div className="relative flex-1">
                  <FolderPlus className="w-4 h-4 absolute left-3 top-2.5 text-indigo-400" />
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder={t.folderNamePlaceholder}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{isCreatingFolder ? 'Создание...' : t.createFolderAction}</span>
                </button>
              </form>
            </div>

            {/* Folder List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!accessToken ? (
                <div className="p-8 text-center text-xs text-slate-400">{t.noDriveToken}</div>
              ) : loadingFolders ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Поиск папок на Google Диске...</span>
                </div>
              ) : driveFolders.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 italic">
                  Папки не найдены. Вы можете создать новую папку выше.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                  {driveFolders.map((folder) => {
                    const isCurrent = settings.backupFolderId === folder.id;
                    return (
                      <div
                        key={folder.id}
                        className="p-3 hover:bg-slate-900/60 transition flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {folder.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">
                            (ID: {folder.id.slice(0, 10)}...)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectFolder(folder)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            isCurrent
                              ? 'bg-emerald-600 text-white cursor-default'
                              : 'bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white'
                          }`}
                        >
                          {isCurrent ? 'Выбрана' : t.selectFolderBtn}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[80vh] shadow-2xl flex flex-col text-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileJson className="w-4 h-4 text-amber-400" />
                <span>{previewFileName}</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewContent(null)}
                className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
              >
                {t.close}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                {previewContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
