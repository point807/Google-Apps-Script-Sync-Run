/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Search, FileCode, Folder, X, CornerDownLeft } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { searchProjects, SearchResult } from '../services/projectSearch';
import { useT } from '../i18n';

export interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ open, onClose }) => {
  const allProjects = useAppStore((s) => s.allProjects);
  const selectProject = useAppStore((s) => s.selectProject);
  const setActiveFileName = useAppStore((s) => s.setActiveFileName);
  const t = useT('search');
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const results = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    return searchProjects(allProjects, query);
  }, [allProjects, query]);

  const handleSelect = (r: SearchResult) => {
    const proj = allProjects.find((p) => p.scriptId === r.projectId);
    if (!proj) return;
    selectProject(proj);
    setActiveFileName(r.fileName);
    onClose();
  };

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIdx]) {
        e.preventDefault();
        handleSelect(results[selectedIdx]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, selectedIdx, allProjects, selectProject, setActiveFileName, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[10vh] bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[75vh]">
        {/* Input */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-500 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.placeholder}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-white rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="p-8 text-center text-xs text-slate-500">{t.hint}</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">{t.noResults}</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {results.map((r, idx) => (
                <button
                  key={`${r.projectId}-${r.fileName}-${r.lineNumber}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition cursor-pointer ${
                    idx === selectedIdx ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'hover:bg-slate-800/60'
                  }`}
                >
                  <FileCode className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-200 truncate">{r.projectTitle}</span>
                      <span className="text-slate-500">/</span>
                      <span className="font-mono text-slate-300">{r.fileName}</span>
                      <span className="text-[10px] text-slate-500">:{r.lineNumber}</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-400 truncate">
                      <span className="text-slate-500">{r.previewBefore.slice(-20)}</span>
                      <span className="bg-amber-500/20 text-amber-200 px-0.5 rounded">
                        {r.lineContent.slice(r.matchStart, r.matchEnd)}
                      </span>
                      <span className="text-slate-500">{r.previewAfter.slice(0, 20)}</span>
                    </div>
                  </div>
                  <Folder className="w-3 h-3 text-slate-600 mt-1 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
          <span>
            {results.length > 0 ? `${results.length} ${t.results}` : ''}{' '}
            {results.length >= 200 ? t.capped : ''}
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> {t.navigate}
          </span>
        </div>
      </div>
    </div>
  );
};
