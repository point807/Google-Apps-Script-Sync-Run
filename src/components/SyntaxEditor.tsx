import React, { useState, useEffect, useMemo, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import {
  Search,
  Replace,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  WrapText,
  Code2,
  X
} from 'lucide-react';
import { ScriptFile } from '../types';

// Robust export unwrapping for react-simple-code-editor between CJS and ESM
const CodeEditorComponent: any =
  (Editor as any)?.default?.render || (Editor as any)?.default?.$$typeof
    ? (Editor as any).default
    : typeof Editor === 'function' || (Editor as any)?.$$typeof
      ? Editor
      : (Editor as any)?.default || Editor;

// Custom syntax extension for Google Apps Script services in PrismJS
if (Prism && Prism.languages && Prism.languages.javascript) {
  // @ts-expect-error PrismJS allows custom language extensions
  Prism.languages.javascript['appsscript-global'] =
    /\b(SpreadsheetApp|DriveApp|DocumentApp|SlidesApp|FormApp|GmailApp|CalendarApp|MailApp|UrlFetchApp|Utilities|Session|PropertiesService|ScriptApp|HtmlService|LanguageApp|Maps|BigQuery|LockService|CacheService|XmlService|ContentService|Logger)\b/;
}

if (Prism && Prism.languages && !Prism.languages.json) {
  Prism.languages.json = Prism.languages.javascript;
}

interface SyntaxEditorProps {
  file: ScriptFile;
  onChange: (newContent: string) => void;
  lang: 'ru' | 'en';
}

export const SyntaxEditor: React.FC<SyntaxEditorProps> = ({ file, onChange, lang: _lang }) => {
  const [fontSize, setFontSize] = useState<number>(13);
  const [wordWrap, setWordWrap] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Search & Replace
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [searchMatchesCount, setSearchMatchesCount] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => (file.source || '').split('\n'), [file.source]);
  const lineCount = Math.max(lines.length, 1);

  // Live syntax highlight using PrismJS
  const highlightCode = (code: string) => {
    const langMode = file.type === 'JSON' ? 'json' : file.type === 'HTML' ? 'markup' : 'javascript';
    const grammar = Prism.languages[langMode] || Prism.languages.javascript;
    return Prism.highlight(code, grammar, langMode);
  };

  // Search matches count
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatchesCount(0);
      return;
    }
    try {
      const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = (file.source || '').match(regex);
      setSearchMatchesCount(matches ? matches.length : 0);
    } catch {
      setSearchMatchesCount(0);
    }
  }, [searchQuery, file.source]);

  // Global keydown for Ctrl+F
  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setShowSearch(true);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(file.source || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const replaced = (file.source || '').replace(regex, replaceQuery);
    onChange(replaced);
  };

  const formatCode = () => {
    if (file.type === 'JSON') {
      try {
        const parsed = JSON.parse(file.source);
        onChange(JSON.stringify(parsed, null, 2));
      } catch (e: any) {
        alert('Ошибка синтаксиса JSON: ' + e.message);
      }
    } else {
      const clean = (file.source || '')
        .split('\n')
        .map((l) => l.trimEnd())
        .join('\n');
      onChange(clean);
    }
  };

  return (
    <div
      onKeyDown={handleContainerKeyDown}
      className={`flex flex-col bg-slate-950 transition-all duration-200 ${
        isFullscreen
          ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl border border-slate-700'
          : 'relative border-0 rounded-none'
      }`}
    >
      {/* Prism Theme Styling */}
      <style>{`
        .prism-editor-container {
          position: relative;
          background-color: transparent !important;
          color: #f1f5f9 !important;
        }
        .prism-editor-container textarea {
          outline: none !important;
        }
        .token.comment, .token.prolog, .token.doctype, .token.cdata {
          color: #64748b !important;
          font-style: italic !important;
        }
        .token.punctuation {
          color: #94a3b8 !important;
        }
        .token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol {
          color: #f59e0b !important;
        }
        .token.selector, .token.attr-name, .token.string, .token.char, .token.builtin {
          color: #34d399 !important;
        }
        .token.operator, .token.entity, .token.url {
          color: #38bdf8 !important;
        }
        .token.atrule, .token.attr-value, .token.keyword {
          color: #c084fc !important;
          font-weight: 600 !important;
        }
        .token.function, .token.class-name {
          color: #60a5fa !important;
        }
        .token.appsscript-global {
          color: #22d3ee !important;
          font-weight: bold !important;
          text-shadow: 0 0 8px rgba(34, 211, 238, 0.2);
        }
        .token.regex, .token.important, .token.variable {
          color: #f43f5e !important;
        }
      `}</style>

      {/* Editor Top Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
        {/* Left: Active File Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300">
            <Code2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-semibold text-white">{file.name}</span>
            <span className="text-slate-500 uppercase">
              {file.type === 'JSON' ? '.json' : file.type === 'HTML' ? '.html' : '.gs'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Редактор с живой подсветкой
          </span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5">
          {/* Search Toggle */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            title="Поиск и замена (Ctrl+F)"
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              showSearch
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Word Wrap Toggle */}
          <button
            type="button"
            onClick={() => setWordWrap(!wordWrap)}
            title={wordWrap ? 'Отключить перенос строк' : 'Включить перенос строк'}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              wordWrap
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
            }`}
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          {/* Font Size Selector */}
          <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setFontSize(Math.max(11, fontSize - 1))}
              className="px-1.5 py-0.5 hover:text-white text-slate-400 font-bold"
              title="Уменьшить шрифт"
            >
              A-
            </button>
            <span className="px-1 text-slate-300 font-mono">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize(Math.min(18, fontSize + 1))}
              className="px-1.5 py-0.5 hover:text-white text-slate-400 font-bold"
              title="Увеличить шрифт"
            >
              A+
            </button>
          </div>

          {/* Format / Beautify */}
          <button
            type="button"
            onClick={formatCode}
            title="Форматировать код"
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition text-[11px] font-medium cursor-pointer"
          >
            Форматировать
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            title="Скопировать весь код"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Search & Replace Panel */}
      {showSearch && (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Найти в коде..."
              autoFocus
              className="flex-1 px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            {searchQuery && (
              <span className="text-[11px] text-slate-400 font-mono">
                {searchMatchesCount} совп.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Replace className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Заменить на..."
              className="flex-1 px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              type="button"
              onClick={handleReplaceAll}
              disabled={!searchQuery || searchMatchesCount === 0}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition text-[11px] font-medium cursor-pointer disabled:opacity-40"
            >
              Заменить все
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSearch(false)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Unified Editor Area: Synchronous Gutter + Code Editor */}
      <div
        ref={containerRef}
        className={`relative flex flex-1 overflow-auto bg-slate-950 ${
          isFullscreen ? 'h-full' : 'min-h-[500px] max-h-[700px]'
        }`}
      >
        {/* Sticky Line Numbers Gutter */}
        <div
          aria-hidden="true"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: '1.6rem',
            paddingTop: '16px',
            paddingBottom: '16px'
          }}
          className="w-12 sm:w-14 shrink-0 text-right pr-3 select-none text-slate-600 border-r border-slate-800/80 bg-slate-950 sticky left-0 z-10 font-mono"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="h-[1.6rem] leading-[1.6rem]">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Live Syntax Highlighted Editable Canvas */}
        <div className="flex-1 min-w-0">
          <CodeEditorComponent
            value={file.source || ''}
            onValueChange={onChange}
            highlight={highlightCode}
            padding={16}
            tabSize={2}
            insertSpaces={true}
            style={{
              fontFamily:
                '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: `${fontSize}px`,
              lineHeight: '1.6rem',
              minHeight: '100%',
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              wordBreak: wordWrap ? 'break-word' : 'normal'
            }}
            textareaClassName="focus:outline-none"
            className="prism-editor-container font-mono text-slate-100 selection:bg-indigo-600/40"
          />
        </div>
      </div>

      {/* Editor Status Bar Footer */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Всего: {lineCount} строк</span>
          </span>
          <span className="text-slate-600">|</span>
          <span>Символов: {(file.source || '').length}</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Табуляция: 2 пробела</span>
          <span className="text-slate-600">|</span>
          <span>UTF-8</span>
          <span className="text-slate-600">|</span>
          <span className="text-indigo-400 font-medium">
            {file.type === 'JSON'
              ? 'JSON'
              : file.type === 'HTML'
                ? 'HTML'
                : 'Google Apps Script (JS)'}
          </span>
        </div>
      </div>
    </div>
  );
};
