/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef } from 'react';
import { Download, Upload, FileJson } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export const SettingsImportExport: React.FC = () => {
  const syncSettings = useAppStore((s) => s.syncSettings);
  const gitHubConfig = useAppStore((s) => s.gitHubConfig);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const updateGitHubConfig = useAppStore((s) => s.updateGitHubConfig);
  const addLog = useAppStore((s) => s.addLog);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      syncSettings,
      gitHubConfig: {
        owner: gitHubConfig.owner,
        repo: gitHubConfig.repo,
        branch: gitHubConfig.branch,
        path: gitHubConfig.path,
        autoPush: gitHubConfig.autoPush
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scriptvault-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('Настройки экспортированы в JSON', 'success', 'drive');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.syncSettings) throw new Error('Некорректный файл настроек');
      if (data.syncSettings) {
        updateSettings(data.syncSettings);
      }
      if (data.gitHubConfig) {
        const currentToken = gitHubConfig.token;
        const currentConnected = gitHubConfig.connected;
        updateGitHubConfig({
          ...gitHubConfig,
          owner: data.gitHubConfig.owner || gitHubConfig.owner,
          repo: data.gitHubConfig.repo || gitHubConfig.repo,
          branch: data.gitHubConfig.branch || gitHubConfig.branch,
          path: data.gitHubConfig.path ?? gitHubConfig.path,
          autoPush: data.gitHubConfig.autoPush ?? gitHubConfig.autoPush,
          token: currentToken,
          connected: currentConnected
        });
      }
      addLog(`Настройки импортированы из ${file.name}`, 'success', 'drive');
      alert(`Настройки успешно импортированы из ${file.name}`);
    } catch (err: any) {
      addLog(`Ошибка импорта настроек: ${err.message}`, 'error', 'drive');
      alert(`Ошибка импорта: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <FileJson className="w-4 h-4 text-indigo-400" />
        Экспорт / импорт настроек
      </h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Сохраните настройки синхронизации и подключения GitHub (без токена) в JSON-файл, чтобы
        поделиться конфигурацией или перенести её на другое устройство. Токен GitHub не
        экспортируется в целях безопасности.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleExport}
          className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Экспортировать JSON
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          className="px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          Импортировать JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};
