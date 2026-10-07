/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { FileText, FileCode, Code2, Trash2, FilePlus, ExternalLink } from 'lucide-react';
import { ScriptFile } from '../types';

export interface FileTabsLabels {
  deleteFile: string;
  addFile: string;
  lines: string;
  chars: string;
  openInEditor: string;
}

export interface FileTabsProps {
  files: ScriptFile[];
  selectedFileIndex: number;
  onSelectFile: (idx: number) => void;
  modifiedFileNames: string[];
  addedFileNames: string[];
  onDeleteFile: (idx: number) => void;
  onAddFile: () => void;
  currentFile: ScriptFile | undefined;
  scriptId: string;
  labels: FileTabsLabels;
}

/** File tab strip: per-file badges (modified/added), delete & add actions, file stats. */
export const FileTabs: React.FC<FileTabsProps> = ({
  files,
  selectedFileIndex,
  onSelectFile,
  modifiedFileNames,
  addedFileNames,
  onDeleteFile,
  onAddFile,
  currentFile,
  scriptId,
  labels
}) => {
  return (
    <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
      <div className="flex items-center gap-1.5">
        {files.map((file, idx) => {
          const isSelected = idx === selectedFileIndex;
          const isJson = file.type === 'JSON' || file.name === 'appsscript';
          const isHtml = file.type === 'HTML';
          const isModified = modifiedFileNames.includes(file.name);
          const isAdded = addedFileNames.includes(file.name);

          return (
            <div
              key={file.name}
              onClick={() => onSelectFile(idx)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer border ${
                isSelected
                  ? 'bg-slate-800 text-white border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-transparent'
              }`}
            >
              {isJson ? (
                <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : isHtml ? (
                <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              ) : (
                <Code2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              )}

              <span>{file.name}</span>
              <span className="text-[10px] text-slate-500 uppercase">
                {isJson ? '.json' : isHtml ? '.html' : '.gs'}
              </span>

              {/* Modified / Added Badges */}
              {isModified && (
                <span
                  title="Файл изменен локально"
                  className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                />
              )}
              {isAdded && (
                <span title="Новый файл" className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              )}

              {files.length > 1 && file.name !== 'appsscript' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFile(idx);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition"
                  title={labels.deleteFile}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddFile}
          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded-lg transition border border-dashed border-slate-800 hover:border-indigo-500/50 cursor-pointer"
          title={labels.addFile}
        >
          <FilePlus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 font-mono">
        {currentFile && (
          <>
            <span>
              {currentFile.source.split('\n').length} {labels.lines}
            </span>
            <span>•</span>
            <span>
              {currentFile.source.length} {labels.chars}
            </span>
          </>
        )}
        <a
          href={`https://script.google.com/home/projects/${scriptId}/edit`}
          target="_blank"
          rel="noreferrer"
          className="text-slate-400 hover:text-indigo-400 transition flex items-center gap-1 font-sans text-xs ml-2"
          title={labels.openInEditor}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Editor</span>
        </a>
      </div>
    </div>
  );
};
