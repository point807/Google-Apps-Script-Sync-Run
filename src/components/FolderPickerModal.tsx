/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { Folder, FolderPlus, RefreshCw, Search } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';
import { DriveFolder } from '../types';
import { listGoogleDriveFolders, createCustomDriveFolder } from '../services/googleDriveService';

export interface FolderPickerModalProps {
  open: boolean;
  onClose: () => void;
}

/** Google Drive folder picker with search and inline folder creation. */
export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({ open, onClose }) => {
  const accessToken = useAppStore((s) => s.accessToken);
  const settings = useAppStore((s) => s.syncSettings);
  const onUpdateSettings = useAppStore((s) => s.updateSettings);
  const addLog = useAppStore((s) => s.addLog);
  const onLog = (msg: string, type?: 'info' | 'success' | 'warning' | 'error') =>
    addLog(msg, type ?? 'info', 'drive');
  const t = useT('backup');

  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const loadFolders = async () => {
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

  useEffect(() => {
    if (open) {
      loadFolders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    onClose();
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

  if (!open) return null;

  return (
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
            onClick={onClose}
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
  );
};
