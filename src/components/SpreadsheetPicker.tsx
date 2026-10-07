import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Search,
  Code2,
  ExternalLink,
  Download,
  Copy,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  FolderSync,
  X,
  Info
} from 'lucide-react';
import { AppsScriptProject, GoogleDriveFile } from '../types';
import { listGoogleSpreadsheets, listGoogleScripts, copySpreadsheetBackup } from '../services/googleDriveService';
import { extractScriptId, extractSpreadsheetId, fetchAppsScriptProject } from '../services/appsScriptService';

interface SpreadsheetPickerProps {
  accessToken: string | null;
  currentProject: AppsScriptProject | null;
  onSelectProject: (project: AppsScriptProject) => void;
  onGoogleSignIn?: () => void;
  lang: 'ru' | 'en';
  onLog: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SpreadsheetPicker: React.FC<SpreadsheetPickerProps> = ({
  accessToken,
  currentProject,
  onSelectProject,
  onGoogleSignIn,
  lang,
  onLog,
}) => {
  const [spreadsheets, setSpreadsheets] = useState<GoogleDriveFile[]>([]);
  const [scripts, setScripts] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'spreadsheets' | 'scripts' | 'manual'>('spreadsheets');
  const [customInput, setCustomInput] = useState('');
  const [fetchingCustom, setFetchingCustom] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal for connecting Apps Script from a spreadsheet
  const [selectedSheetModal, setSelectedSheetModal] = useState<GoogleDriveFile | null>(null);
  const [modalScriptInput, setModalScriptInput] = useState('');
  const [loadingModalScript, setLoadingModalScript] = useState(false);

  const t = {
    ru: {
      title: 'Google Таблицы и Apps Script',
      subtitle: 'Подключение таблиц со встроенным кодом или автономных проектов Apps Script из вашего Google Диска',
      tabs: {
        spreadsheets: 'Таблицы Google Sheets',
        scripts: 'Автономные Apps Script',
        manual: 'Ввести ссылку / ID',
      },
      searchPlaceholder: 'Поиск по названию файлов...',
      refresh: 'Обновить список',
      demoTemplates: 'Готовые шаблоны скриптов для тестирования:',
      noFilesFound: 'Файлы не найдены в вашем Google Диске.',
      connectGoogleMsg: 'Войдите через Google в шапке сайта, чтобы просмотреть файлы с вашего Google Диска.',
      currentActive: 'Текущий активный проект:',
      loadProject: 'Загрузить скрипт',
      connectScript: 'Подключить Apps Script',
      loadingScript: 'Загрузка...',
      openInSheets: 'Открыть в Sheets',
      openInDrive: 'Диск',
      exportSheet: 'Копия на Диске',
      exporting: 'Копирование...',
      customLabel: 'Вставьте ссылку на проект Apps Script или его Script ID:',
      customHelper: 'Примеры:\n• https://script.google.com/home/projects/1abc.../edit\n• ID скрипта: 1aB2cD3eF4...',
      fetchBtn: 'Получить код скрипта',
      boundScriptNotice: 'Важно: идентификатор Google Таблицы отличается от Script ID прикрепленного к ней скрипта.',
    },
    en: {
      title: 'Google Sheets & Apps Script',
      subtitle: 'Connect spreadsheets with bound code or standalone Apps Script projects from Google Drive',
      tabs: {
        spreadsheets: 'Google Spreadsheets',
        scripts: 'Standalone Scripts',
        manual: 'Direct URL / Script ID',
      },
      searchPlaceholder: 'Search files by name...',
      refresh: 'Refresh files',
      demoTemplates: 'Quick-test templates ready to use:',
      noFilesFound: 'No files found in your Google Drive.',
      connectGoogleMsg: 'Sign in with Google in the top bar to access your real Drive files.',
      currentActive: 'Currently loaded project:',
      loadProject: 'Load Script',
      connectScript: 'Connect Apps Script',
      loadingScript: 'Loading...',
      openInSheets: 'Open in Sheets',
      openInDrive: 'Drive',
      exportSheet: 'Drive Backup',
      exporting: 'Copying...',
      customLabel: 'Paste Apps Script editor URL or Script ID:',
      customHelper: 'Examples:\n• https://script.google.com/home/projects/1abc.../edit\n• Script ID: 1aB2cD3eF4...',
      fetchBtn: 'Fetch Project Code',
      boundScriptNotice: 'Important: A spreadsheet ID is different from the Script ID of its attached Apps Script.',
    },
  }[lang];

  const loadDriveFiles = async () => {
    if (!accessToken) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      if (viewMode === 'spreadsheets') {
        const list = await listGoogleSpreadsheets(accessToken, searchQuery);
        setSpreadsheets(list);
      } else if (viewMode === 'scripts') {
        const list = await listGoogleScripts(accessToken, searchQuery);
        setScripts(list);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
      onLog(`Ошибка загрузки файлов: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadDriveFiles();
    }
  }, [accessToken, viewMode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDriveFiles();
  };

  const handleFetchCustom = async () => {
    if (!customInput.trim()) return;
    setFetchingCustom(true);
    setErrorMessage(null);

    // Detect if user pasted a Google Sheet link instead of an Apps Script link
    if (customInput.includes('docs.google.com/spreadsheets/d/')) {
      const match = customInput.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      const sheetId = match ? match[1] : '';
      setErrorMessage(
        `Вы вставили ссылку на Google Таблицу вместо ссылки на скрипт Apps Script.\n\n` +
        `У Google Таблицы и встроенного в нее скрипта разные ID.\n` +
        `Чтобы получить Script ID:\n` +
        `1. Откройте таблицу в Google и выберите в меню: «Расширения» → «Apps Script».\n` +
        `2. Скопируйте ссылку из адресной строки открывшегося редактора скрипта (https://script.google.com/home/projects/.../edit) или нажмите Настройки проекта (⚙️) и скопируйте «Идентификатор скрипта».\n` +
        `3. Вставьте скопированный URL сюда.`
      );
      setFetchingCustom(false);
      return;
    }

    const scriptId = extractScriptId(customInput);

    try {
      if (accessToken) {
        onLog(`Запрос проекта Apps Script (${scriptId})...`, 'info');
        const project = await fetchAppsScriptProject(scriptId, accessToken);
        onSelectProject(project);
        onLog(`Проект "${project.title}" успешно загружен (${project.files.length} файлов)`, 'success');
      } else {
        onLog('Необходимо войти через Google для выгрузки реального скрипта', 'warning');
        setErrorMessage('Пожалуйста, выполните вход через Google в правом верхнем углу для доступа к Apps Script API.');
      }
    } catch (err: any) {
      setErrorMessage(err.message);
      onLog(`Ошибка загрузки скрипта: ${err.message}`, 'error');
    } finally {
      setFetchingCustom(false);
    }
  };

  const handleCopySpreadsheet = async (sheet: GoogleDriveFile) => {
    if (!accessToken) return;
    try {
      onLog(`Создание резервной копии таблицы "${sheet.name}" на Google Диске...`, 'info');
      const backupTitle = `[Backup_${new Date().toISOString().slice(0, 10)}] ${sheet.name}`;
      const copyId = await copySpreadsheetBackup(accessToken, sheet.id, backupTitle);
      onLog(`Резервная копия таблицы успешно создана на Диске (ID: ${copyId})`, 'success');
      alert(`Резервная копия таблицы сохранена на вашем Google Диске как: "${backupTitle}"`);
    } catch (err: any) {
      onLog(`Ошибка копирования таблицы: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    }
  };

  const handleLoadScriptForFile = async (file: GoogleDriveFile) => {
    if (!accessToken) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      onLog(`Загрузка скрипта "${file.name}"...`, 'info');
      const project = await fetchAppsScriptProject(file.id, accessToken);
      project.parentTitle = file.name;
      onSelectProject(project);
      onLog(`Скрипт "${project.title}" успешно загружен`, 'success');
    } catch (err: any) {
      setErrorMessage(err.message);
      onLog(`Ошибка: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSheetModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSheetModal || !modalScriptInput.trim() || !accessToken) return;

    if (modalScriptInput.includes('docs.google.com/spreadsheets/d/')) {
      alert('Пожалуйста, укажите ссылку на Apps Script редактор (script.google.com) или Script ID, а не ссылку на таблицу.');
      return;
    }

    setLoadingModalScript(true);
    try {
      const scriptId = extractScriptId(modalScriptInput);
      onLog(`Загрузка скрипта ${scriptId} для таблицы "${selectedSheetModal.name}"...`, 'info');
      const project = await fetchAppsScriptProject(scriptId, accessToken);
      project.parentTitle = selectedSheetModal.name;
      project.parentId = selectedSheetModal.id;
      onSelectProject(project);
      onLog(`Скрипт "${project.title}" привязан к таблице "${selectedSheetModal.name}"`, 'success');
      setSelectedSheetModal(null);
      setModalScriptInput('');
    } catch (err: any) {
      alert(`Ошибка загрузки: ${err.message}`);
    } finally {
      setLoadingModalScript(false);
    }
  };

  const isSpreadsheetInput =
    customInput.includes('docs.google.com/spreadsheets') ||
    (customInput.length > 20 &&
      !customInput.includes('script.google.com') &&
      spreadsheets.some((s) => s.id === customInput));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            {t.title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
        </div>

        {currentProject && (
          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400">{t.currentActive} </span>
            <span className="font-semibold text-emerald-400">{currentProject.title}</span>
            <div className="text-[11px] text-slate-500 font-mono">
              {currentProject.files.length} файлов • ID: {currentProject.scriptId.slice(0, 8)}...
            </div>
          </div>
        )}
      </div>

      {/* Tabs & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('spreadsheets')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                viewMode === 'spreadsheets'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.tabs.spreadsheets}
            </button>
            <button
              onClick={() => setViewMode('scripts')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                viewMode === 'scripts'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.tabs.scripts}
            </button>
            <button
              onClick={() => setViewMode('manual')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                viewMode === 'manual'
                  ? 'bg-purple-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.tabs.manual}
            </button>
          </div>

          {viewMode !== 'manual' && (
            <div className="flex items-center gap-2">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="pl-9 pr-4 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-56 sm:w-64 font-sans"
                />
              </form>
              <button
                onClick={loadDriveFiles}
                disabled={loading || !accessToken}
                title={t.refresh}
                className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap leading-relaxed text-slate-200">
                {errorMessage}
              </div>
            </div>

            {/* Quick Actions if API disabled in GCP */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
              <a
                href="https://console.developers.google.com/apis/api/script.googleapis.com/overview?project=385972489711"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/30"
              >
                <span>Включить Apps Script API в Google Cloud</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {onGoogleSignIn && (
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  Обновить сессию Google
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setViewMode('manual');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl transition cursor-pointer"
              >
                Ввести Script ID вручную
              </button>
            </div>
          </div>
        )}

        {/* View Mode: Manual URL / Script ID */}
        {viewMode === 'manual' ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                {t.customLabel}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => {
                    setCustomInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="https://script.google.com/home/projects/.../edit или Script ID"
                  className="flex-1 px-4 py-2.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleFetchCustom}
                  disabled={fetchingCustom || !customInput.trim()}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {fetchingCustom ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {t.loadingScript}
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      {t.fetchBtn}
                    </>
                  )}
                </button>
              </div>

              {isSpreadsheetInput && (
                <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-600/40 text-xs text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold">Вы вставили ссылку на Google Таблицу, а не на Apps Script!</span>
                    <p className="text-[11px] text-amber-300/90 leading-relaxed">
                      У Google Таблицы и встроенного в нее скрипта разные ID. Чтобы открыть прикрепленный скрипт, откройте таблицу в Google и в меню выберите: <b>«Расширения» → «Apps Script»</b>. Затем скопируйте ссылку из адресной строки редактора (https://script.google.com/home/projects/...).
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-900/30 text-xs text-indigo-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">{t.boundScriptNotice}</div>
                  <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap">{t.customHelper}</pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Drive Files List */
          <div className="space-y-3">
            {!accessToken ? (
              <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-400 space-y-3">
                <FolderSync className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs">{t.connectGoogleMsg}</p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Вы можете исследовать код прямо сейчас, используя готовые шаблоны выше, либо подключить Google Диск для работы со своими таблицами.
                </p>
              </div>
            ) : loading ? (
              <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-400 flex items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="text-xs">Загрузка файлов с Google Диска...</span>
              </div>
            ) : viewMode === 'spreadsheets' ? (
              spreadsheets.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-400 text-xs">
                  {t.noFilesFound}
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60">
                  {spreadsheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      className="p-4 hover:bg-slate-900/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-200 truncate">{sheet.name}</h4>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span>ID таблицы: <code className="text-slate-400 font-mono">{sheet.id.slice(0, 12)}...</code></span>
                            {sheet.modifiedTime && (
                              <span>Изм.: {new Date(sheet.modifiedTime).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleCopySpreadsheet(sheet)}
                          title="Создать резервную копию таблицы на Google Диске"
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{t.exportSheet}</span>
                        </button>
                        {sheet.webViewLink && (
                          <a
                            href={sheet.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                            title={t.openInSheets}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSheetModal(sheet);
                            setModalScriptInput('');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/30 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          <span>{t.connectScript}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : scripts.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-400 text-xs">
                {t.noFilesFound}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60">
                {scripts.map((script) => (
                  <div
                    key={script.id}
                    className="p-4 hover:bg-slate-900/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 mt-0.5">
                        <Code2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-200 truncate">{script.name}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span>Script ID: <code className="text-slate-400 font-mono">{script.id.slice(0, 14)}...</code></span>
                          {script.modifiedTime && (
                            <span>Изм.: {new Date(script.modifiedTime).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {script.webViewLink && (
                        <a
                          href={script.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                          title={t.openInDrive}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleLoadScriptForFile(script)}
                        className="px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg border border-indigo-500/30 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>{t.loadProject}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Connect Apps Script from Spreadsheet */}
      {selectedSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col text-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm sm:text-base truncate max-w-[340px]">
                  Подключение скрипта: {selectedSheetModal.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSheetModal(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Чтобы загрузить встроенный код этой таблицы в ScriptVault, скопируйте ссылку на прикрепленный Apps Script:
              </p>

              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Шаг 1. Откройте таблицу в Google:</span>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${selectedSheetModal.id}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg transition flex items-center gap-1.5 font-medium"
                  >
                    <span>Открыть таблицу</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-semibold text-slate-200">Шаг 2. Откройте редактор скрипта:</span>
                <p className="text-slate-400 leading-relaxed">
                  В верхнем меню открытой таблицы нажмите: <br />
                  <b className="text-white bg-slate-800 px-1.5 py-0.5 rounded">Расширения (Extensions)</b> → <b className="text-white bg-slate-800 px-1.5 py-0.5 rounded">Apps Script</b>.
                </p>
              </div>

              {/* Step 3 Form */}
              <form onSubmit={handleConnectSheetModalSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Шаг 3. Вставьте ссылку на редактор Apps Script или Script ID:
                  </label>
                  <input
                    type="text"
                    value={modalScriptInput}
                    onChange={(e) => setModalScriptInput(e.target.value)}
                    placeholder="https://script.google.com/home/projects/.../edit или Script ID"
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    (Ссылка из адресной строки вкладки Apps Script или ⚙️ Настройки проекта → «Идентификатор скрипта»)
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSheetModal(null)}
                    className="px-3.5 py-2 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={loadingModalScript || !modalScriptInput.trim()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-emerald-600/20"
                  >
                    {loadingModalScript ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Загрузка...</span>
                      </>
                    ) : (
                      <>
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Загрузить код скрипта</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
