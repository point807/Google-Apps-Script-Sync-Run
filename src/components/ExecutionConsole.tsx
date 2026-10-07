/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { Terminal, X } from 'lucide-react';
import { ScriptFile } from '../types';
import { FunctionRunResult } from '../services/appsScriptService';

export interface ExecutionConsoleProps {
  currentFile: ScriptFile | undefined;
  selectedFunction: string;
  runResult: FunctionRunResult;
  onClose: () => void;
}

/** In-editor console: status badge, return value, error and Logger.log output. */
export const ExecutionConsole: React.FC<ExecutionConsoleProps> = ({
  currentFile,
  selectedFunction,
  runResult,
  onClose
}) => {
  return (
    <div className="border-t border-slate-800 bg-slate-950 p-4 space-y-3 animate-in fade-in">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white">Консоль выполнения:</span>
          <span className="text-xs font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            [{currentFile?.name}] → {selectedFunction}()
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
              runResult.status === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                runResult.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span>{runResult.status === 'success' ? 'Успешно' : 'Ошибка'}</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">{runResult.durationMs} ms</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono uppercase">
            {runResult.source === 'cloud' ? 'Google Cloud API' : 'Apps Script Runner'}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
            title="Скрыть консоль"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Local runner safety warning */}
      {runResult.source === 'local_runner' && (
        <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300">
          ⚠ Код выполняется локально в вашем браузере (песочница), а не в Google Apps Script.
          Сервисы Google (SpreadsheetApp, DriveApp, UrlFetchApp и т.п.) в этом режиме недоступны.
        </div>
      )}

      {/* Error Message if any */}
      {runResult.error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 font-mono">
          <div className="font-bold mb-1">Ошибка при выполнении:</div>
          <div>{runResult.error}</div>
        </div>
      )}

      {/* Return Value */}
      {runResult.status === 'success' && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
            Результат (Return Value):
          </div>
          <pre className="text-xs font-mono text-emerald-400 overflow-x-auto m-0">
            {typeof runResult.result === 'object'
              ? JSON.stringify(runResult.result, null, 2)
              : String(runResult.result)}
          </pre>
        </div>
      )}

      {/* Logger.log lines */}
      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
        <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider flex items-center justify-between">
          <span>Журнал Logger.log ({runResult.logs.length} строк):</span>
        </div>
        <div className="space-y-1 font-mono text-xs max-h-48 overflow-y-auto">
          {runResult.logs.map((logLine, idx) => (
            <div
              key={idx}
              className="text-slate-300 leading-relaxed border-l-2 border-slate-700 pl-2"
            >
              {logLine}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
