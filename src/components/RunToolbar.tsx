/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { RefreshCw, Play, Terminal, Rocket } from 'lucide-react';
import { ScriptFile } from '../types';
import { FunctionRunResult, ScriptFunctionInfo } from '../services/appsScriptService';

export interface RunToolbarProps {
  currentFile: ScriptFile | undefined;
  currentFileFunctions: ScriptFunctionInfo[];
  otherFilesFunctions: ScriptFunctionInfo[];
  selectedFunction: string;
  setSelectedFunction: (fn: string) => void;
  isRunningFunction: boolean;
  onExecute: () => void;
  runResult: FunctionRunResult | null;
  showRunConsole: boolean;
  onToggleConsole: () => void;
  onOpenDeployments: () => void;
}

/** Editor subheader: active file context, function selector, run button, console toggle. */
export const RunToolbar: React.FC<RunToolbarProps> = ({
  currentFile,
  currentFileFunctions,
  otherFilesFunctions,
  selectedFunction,
  setSelectedFunction,
  isRunningFunction,
  onExecute,
  runResult,
  showRunConsole,
  onToggleConsole,
  onOpenDeployments
}) => {
  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      {/* Active File Context & Run Controls */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Clear Active File Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
          <span className="text-slate-400">Файл:</span>
          <span className="font-bold text-emerald-400">{currentFile?.name}</span>
          <span className="text-[10px] text-slate-500 uppercase">
            {currentFile?.type === 'HTML'
              ? '.html'
              : currentFile?.type === 'JSON'
                ? '.json'
                : '.gs'}
          </span>
        </div>

        {/* Function Selector for this File */}
        <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400">Функция:</span>
          {currentFileFunctions.length > 0 || otherFilesFunctions.length > 0 ? (
            <select
              value={selectedFunction}
              onChange={(e) => setSelectedFunction(e.target.value)}
              className="bg-transparent text-xs font-mono font-semibold text-white focus:outline-none cursor-pointer pr-1 max-w-[220px] truncate"
            >
              {currentFileFunctions.length > 0 && (
                <optgroup label={`Функции в этом файле (${currentFile?.name})`}>
                  {currentFileFunctions.map((fn) => (
                    <option
                      key={`curr-${fn.name}`}
                      value={fn.name}
                      className="bg-slate-900 text-emerald-300"
                    >
                      ▶ {fn.name}()
                    </option>
                  ))}
                </optgroup>
              )}
              {otherFilesFunctions.length > 0 && (
                <optgroup label={`Другие файлы проекта`}>
                  {otherFilesFunctions.map((fn) => (
                    <option
                      key={`other-${fn.fileName}-${fn.name}`}
                      value={fn.name}
                      className="bg-slate-900 text-slate-300"
                    >
                      {fn.name}() [{fn.fileName}]
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          ) : (
            <input
              type="text"
              value={selectedFunction}
              onChange={(e) => setSelectedFunction(e.target.value)}
              placeholder="Имя функции (например: myFunction)"
              className="bg-transparent text-xs font-mono text-white placeholder-slate-500 focus:outline-none w-44"
            />
          )}
        </div>

        <button
          type="button"
          onClick={onOpenDeployments}
          className="px-2.5 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
          title="Версии и деплои (для облачного запуска)"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Деплой</span>
        </button>

        {/* Run Button in Editor! */}
        <button
          type="button"
          onClick={onExecute}
          disabled={isRunningFunction || !selectedFunction}
          className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title={`Запустить функцию "${selectedFunction}()" из файла ${currentFile?.name}`}
        >
          {isRunningFunction ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Выполнение...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Запустить {selectedFunction ? `"${selectedFunction}()"` : 'скрипт'}</span>
            </>
          )}
        </button>
      </div>

      {/* Right side: Console toggle & Stats */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-500">
          Найдено в <span className="font-mono text-slate-400">{currentFile?.name}</span>:{' '}
          <strong className="text-emerald-400 font-mono">{currentFileFunctions.length}</strong> ф-й
        </span>

        {runResult && (
          <button
            type="button"
            onClick={onToggleConsole}
            className={`px-2.5 py-1 text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer border ${
              runResult.status === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>
              {showRunConsole ? 'Скрыть консоль' : 'Результат'} ({runResult.durationMs}ms)
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
