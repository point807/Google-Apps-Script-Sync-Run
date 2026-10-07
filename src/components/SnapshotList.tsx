/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { Calendar, FileJson, Layers, RefreshCw, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';
import { DriveBackupSnapshot } from '../types';
import {
  getOrCreateBackupFolder,
  listDriveSnapshots,
  downloadDriveFileContent,
  parseSnapshotPayload
} from '../services/googleDriveService';
import { updateAppsScriptProject } from '../services/appsScriptService';

/** Stored Drive snapshots with a preview modal. */
export const SnapshotList: React.FC = () => {
  const accessToken = useAppStore((s) => s.accessToken);
  const settings = useAppStore((s) => s.syncSettings);
  const onUpdateSettings = useAppStore((s) => s.updateSettings);
  const onRestoreVersion = useAppStore((s) => s.restoreVersion);
  const addLog = useAppStore((s) => s.addLog);
  const onLog = (msg: string, type?: 'info' | 'success' | 'warning' | 'error') =>
    addLog(msg, type ?? 'info', 'drive');
  const t = useT('backup');

  const [snapshots, setSnapshots] = useState<DriveBackupSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [snapshotToRestore, setSnapshotToRestore] = useState<DriveBackupSnapshot | null>(null);
  const [restoreDeploy, setRestoreDeploy] = useState(false);
  const [restoring, setRestoring] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, settings.backupFolderId, settings.backupFolderName]);

  const handleConfirmRestore = async () => {
    const snapshot = snapshotToRestore;
    if (!snapshot || !accessToken) return;
    setRestoring(true);
    try {
      onLog(`Загрузка снимка ${snapshot.fileName} для восстановления...`, 'info');
      const text = await downloadDriveFileContent(accessToken, snapshot.fileId);
      const payload = parseSnapshotPayload(text);
      const message = `Восстановление из снимка Drive: ${snapshot.fileName}`;
      onRestoreVersion(payload.files, message, restoreDeploy);
      if (restoreDeploy && !payload.scriptId.startsWith('1DEMO_')) {
        onLog(
          `Отправка восстановленного кода в Google Apps Script (${payload.scriptId})...`,
          'info'
        );
        await updateAppsScriptProject(payload.scriptId, payload.files, accessToken);
      }
      onLog(
        `Проект восстановлен из снимка ${snapshot.fileName} (${payload.files.length} файлов)`,
        'success'
      );
      setSnapshotToRestore(null);
      setRestoreDeploy(false);
    } catch (err: any) {
      onLog(`Ошибка восстановления: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setRestoring(false);
    }
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

  return (
    <>
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
                    onClick={() => {
                      setSnapshotToRestore(s);
                      setRestoreDeploy(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 transition cursor-pointer text-xs"
                  >
                    {t.restoreBtn}
                  </button>

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

      {/* Restore Confirmation Modal */}
      {snapshotToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-indigo-400" />
              {t.restoreModalTitle}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t.restoreModalDesc}</p>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 truncate">
              {snapshotToRestore.fileName}
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={restoreDeploy}
                onChange={(e) => setRestoreDeploy(e.target.checked)}
                className="mt-0.5 accent-indigo-500"
              />
              <span>{t.restoreDeployLabel}</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSnapshotToRestore(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                {t.close}
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                {restoring ? t.restoringBtn : t.restoreConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
