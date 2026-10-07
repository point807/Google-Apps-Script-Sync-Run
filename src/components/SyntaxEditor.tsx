/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { Suspense, lazy, useState, useRef } from 'react';
import {
  Search,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  WrapText,
  Code2,
  Minus,
  Plus,
  Undo2,
  Redo2
} from 'lucide-react';
import { ScriptFile } from '../types';
import type * as Monaco from 'monaco-editor';

const MonacoEditor = lazy(() => import('./MonacoEditor'));

interface SyntaxEditorProps {
  file: ScriptFile;
  onChange: (newContent: string) => void;
  lang: 'ru' | 'en';
}

/** Code editor pane: monaco (async chunk) with a slim toolbar. */
export const SyntaxEditor: React.FC<SyntaxEditorProps> = ({ file, onChange, lang: _lang }) => {
  const [fontSize, setFontSize] = useState<number>(13);
  const [wordWrap, setWordWrap] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [findSignal, setFindSignal] = useState<number>(0);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(file.source || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions / insecure context)
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-900 ${
        isFullscreen ? 'fixed inset-0 z-[80] p-4' : 'h-full'
      }`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950/80">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Code2 className="w-4 h-4 text-indigo-400" />
          <span className="font-mono text-slate-200 font-semibold">{file.name}</span>
          <span className="text-[10px] uppercase">
            {file.type === 'JSON' ? '.json' : file.type === 'HTML' ? '.html' : '.gs'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="font-mono">{(file.source || '').split('\n').length} стр.</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Font size */}
          <button
            type="button"
            onClick={() => setFontSize((s) => Math.max(10, s - 1))}
            className="p-1.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
            title="Уменьшить шрифт"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-500 font-mono w-5 text-center">{fontSize}</span>
          <button
            type="button"
            onClick={() => setFontSize((s) => Math.min(24, s + 1))}
            className="p-1.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
            title="Увеличить шрифт"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setWordWrap((w) => !w)}
            className={`p-1.5 rounded transition cursor-pointer ${
              wordWrap ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white'
            }`}
            title="Перенос строк"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => (editorRef.current as any)?.trigger('toolbar', 'undo', null)}
            className="p-1.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
            title="Отменить (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => (editorRef.current as any)?.trigger('toolbar', 'redo', null)}
            className="p-1.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
            title="Повторить (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setFindSignal((s) => s + 1)}
            className="p-1.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
            title="Поиск и замена (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
            title="Копировать код"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="p-1.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
            title={isFullscreen ? 'Свернуть' : 'На весь экран'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <textarea
              value={file.source || ''}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              className="w-full h-full bg-slate-900 text-slate-200 font-mono text-[13px] p-4 resize-none focus:outline-none"
            />
          }
        >
          <MonacoEditor
            file={file}
            onChange={onChange}
            fontSize={fontSize}
            wordWrap={wordWrap}
            findSignal={findSignal}
            onEditorMount={(editor) => {
              editorRef.current = editor as unknown as Monaco.editor.IStandaloneCodeEditor;
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};
