import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  Clock,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  Folder,
  Check,
  Code2,
  FileSpreadsheet,
  Settings2
} from 'lucide-react';
import { useT } from '../i18n';
import { FolderPickerModal } from './FolderPickerModal';
import { SnapshotList } from './SnapshotList';
import { SettingsImportExport } from './SettingsImportExport';

export const BackupDrivePanel: React.FC = () => {
  const allProjects = useAppStore((s) => s.allProjects);
  const settings = useAppStore((s) => s.syncSettings);
  const onUpdateSettings = useAppStore((s) => s.updateSettings);
  const onTriggerBackupNow = useAppStore((s) => s.manualSync);
  const isSyncing = useAppStore((s) => s.isSyncing);
  const addLog = useAppStore((s) => s.addLog);
  const onLog = (msg: string, type?: 'info' | 'success' | 'warning' | 'error') =>
    addLog(msg, type ?? 'info', 'drive');
  // Folder selector state
  const [showFolderModal, setShowFolderModal] = useState(false);

  // Frequency custom input
  const [customSeconds, setCustomSeconds] = useState(settings.intervalSeconds);

  const t = useT('backup');

  // Load snapshots from the currently selected folder

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
              onClick={() => setShowFolderModal(true)}
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

      <SnapshotList />

      <SettingsImportExport />

      <FolderPickerModal open={showFolderModal} onClose={() => setShowFolderModal(false)} />
    </div>
  );
};
