/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ChevronDown,
  Download,
  FileCode2,
  FileJson,
  FolderInput,
  Loader2,
  Upload
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { AppsScriptProject } from '../types';
import { downloadBlob, downloadText, safeFileName } from '../services/download';
import {
  buildAppsScriptContentJson,
  buildProjectBundle,
  importProjectFromFiles,
  projectToZipBlob
} from '../services/projectTransfer';
import { downloadSingleFile } from '../services/appsScriptService';
import { useT } from '../i18n';

const IMPORT_ACCEPT = '.zip,.json,.gs,.js,.html,.htm,.txt';

/**
 * Shared import pipeline: hidden file input + File → project → store, with the
 * same logging/toasts everywhere the button appears.
 */
const useProjectImport = () => {
  const importProject = useAppStore((s) => s.importProject);
  const showToast = useAppStore((s) => s.showToast);
  const addLog = useAppStore((s) => s.addLog);
  const t = useT('transfer');
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setImporting(true);
    addLog(
      `Импорт из файлов: ${Array.from(fileList)
        .map((f) => f.name)
        .join(', ')}`,
      'info',
      'git'
    );
    try {
      const { project, warnings } = await importProjectFromFiles(fileList);
      const { updated } = importProject(project);

      const summary = `${updated ? t.reimported : t.imported}: "${project.title}" — ${project.files.length} ${t.filesCount}`;
      showToast(summary, 'success');
      warnings.forEach((warning) => {
        addLog(warning, 'warning', 'git');
        showToast(warning, 'warning');
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`Ошибка импорта: ${message}`, 'error', 'git');
      showToast(`Ошибка импорта: ${message}`, 'error');
    } finally {
      setImporting(false);
      // Allow re-selecting the same file.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={IMPORT_ACCEPT}
      className="hidden"
      data-testid="project-import-input"
      onChange={(e) => void handleFiles(e.target.files)}
    />
  );

  return {
    importing,
    open: () => inputRef.current?.click(),
    input
  };
};

/** Import button used by the empty state (no project selected yet). */
export const ProjectImportButton: React.FC = () => {
  const t = useT('transfer');
  const { open, importing, input } = useProjectImport();

  return (
    <>
      {input}
      <button
        type="button"
        onClick={open}
        disabled={importing}
        title={t.importOnlyHint}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors border border-slate-700 disabled:opacity-50 cursor-pointer"
      >
        {importing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FolderInput className="w-4 h-4" />
        )}
        {importing ? t.importing : t.importOnlyLabel}
      </button>
    </>
  );
};

type ExportAction = 'zip' | 'bundle' | 'content' | 'files';

export interface ProjectFilesMenuProps {
  project: AppsScriptProject;
}

/** Import/export dropdown: ZIP, JSON bundle, Apps Script JSON, loose files. */
export const ProjectFilesMenu: React.FC<ProjectFilesMenuProps> = ({ project }) => {
  const t = useT('transfer');
  const addLog = useAppStore((s) => s.addLog);
  const showToast = useAppStore((s) => s.showToast);
  const { open: openImport, importing, input } = useProjectImport();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportAction | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside / Escape closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const baseName = safeFileName(project.title, 'AppsScript');
  const stamp = new Date().toISOString().slice(0, 10);

  const runExport = async (action: ExportAction) => {
    setBusy(action);
    setOpen(false);
    try {
      switch (action) {
        case 'zip': {
          downloadBlob(await projectToZipBlob(project), `${baseName}_${stamp}.zip`);
          break;
        }
        case 'bundle': {
          downloadText(
            buildProjectBundle(project),
            `${baseName}.scriptvault.json`,
            'application/json;charset=utf-8'
          );
          break;
        }
        case 'content': {
          downloadText(
            buildAppsScriptContentJson(project),
            `${baseName}.appsscript-api.json`,
            'application/json;charset=utf-8'
          );
          break;
        }
        case 'files': {
          project.files.forEach((file, index) => {
            // Stagger: browsers throttle a burst of programmatic downloads.
            setTimeout(() => downloadSingleFile(file, project.title), index * 150);
          });
          break;
        }
      }
      addLog(
        `Экспорт проекта "${project.title}" (${action}, ${project.files.length} файлов)`,
        'success',
        'git'
      );
      showToast(`${t.downloaded}: ${baseName}`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`Ошибка экспорта: ${message}`, 'error', 'git');
      showToast(`Ошибка экспорта: ${message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const items: { action: ExportAction; icon: React.ReactNode; label: string }[] = [
    { action: 'zip', icon: <Archive className="w-3.5 h-3.5" />, label: t.exportZip },
    { action: 'bundle', icon: <FileJson className="w-3.5 h-3.5" />, label: t.exportBundle },
    { action: 'content', icon: <FileCode2 className="w-3.5 h-3.5" />, label: t.exportContent },
    { action: 'files', icon: <Download className="w-3.5 h-3.5" />, label: t.exportFiles }
  ];

  return (
    <div className="relative" ref={menuRef}>
      {input}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t.menuTitle}
        className="px-2.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
      >
        {busy || importing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FolderInput className="w-3.5 h-3.5" />
        )}
        <span>{t.button}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-72 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-1.5 animate-in fade-in">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openImport();
            }}
            className="w-full px-2.5 py-2 text-left text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {t.importLabel}
          </button>
          <p className="px-2.5 pb-1.5 text-[10px] leading-relaxed text-slate-500">{t.importHint}</p>
          <div className="h-px bg-slate-800 my-1" />
          {items.map((item) => (
            <button
              key={item.action}
              type="button"
              onClick={() => void runExport(item.action)}
              className="w-full px-2.5 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 rounded-lg transition flex items-center gap-2 cursor-pointer"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectFilesMenu;
