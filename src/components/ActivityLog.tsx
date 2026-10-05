import React, { useState } from 'react';
import {
  Terminal,
  Trash2,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Clock,
  Layers
} from 'lucide-react';
import { SyncLogEntry } from '../types';

interface ActivityLogProps {
  logs: SyncLogEntry[];
  onClearLogs: () => void;
  lang: 'ru' | 'en';
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs, onClearLogs, lang }) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const t = {
    ru: {
      title: 'Журнал активности и синхронизации',
      subtitle: 'История всех операций Google Диска, Git, GitHub и мониторинга в реальном времени',
      clear: 'Очистить журнал',
      export: 'Экспорт журнала',
      noLogs: 'Записей в журнале пока нет. Они будут появляться по мере работы системы.',
      all: 'Все категории',
    },
    en: {
      title: 'Live Activity & Sync Log',
      subtitle: 'Full audit log of Drive snapshots, Git commits, GitHub pushes, and real-time watcher events',
      clear: 'Clear Log',
      export: 'Export Log',
      noLogs: 'No log entries recorded yet.',
      all: 'All Categories',
    },
  }[lang];

  const filteredLogs = logs.filter(
    (l) => filterCategory === 'all' || l.category === filterCategory
  );

  const handleExportLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toISOString()}] [${l.category.toUpperCase()}] [${l.type.toUpperCase()}] ${l.message} ${
            l.details ? `\nDetails: ${l.details}` : ''
          }`
      )
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scriptvault_log_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getBadgeStyle = (category: string) => {
    switch (category) {
      case 'drive':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'github':
        return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
      case 'git':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
      case 'realtime':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
      case 'apps_script':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Terminal className="w-6 h-6 text-indigo-400" />
            {t.title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{t.all}</option>
            <option value="realtime">Real-time Watcher</option>
            <option value="drive">Google Drive</option>
            <option value="git">Git Engine</option>
            <option value="github">GitHub</option>
            <option value="apps_script">Apps Script API</option>
          </select>

          <button
            type="button"
            onClick={handleExportLogs}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.export}</span>
          </button>

          <button
            type="button"
            onClick={onClearLogs}
            className="px-3 py-1.5 text-xs font-medium text-red-300 hover:text-red-200 bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.clear}</span>
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-4 overflow-hidden font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 italic">{t.noLogs}</div>
        ) : (
          <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto space-y-0.5">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="py-2.5 px-2 hover:bg-slate-900/50 transition flex items-start gap-3"
              >
                <div className="mt-0.5">{getTypeIcon(log.type)}</div>

                <div className="text-slate-500 shrink-0 text-[11px] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>

                <div
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 border ${getBadgeStyle(
                    log.category
                  )}`}
                >
                  {log.category}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-slate-200 break-words leading-relaxed">{log.message}</div>
                  {log.details && (
                    <div className="text-slate-400 text-[11px] mt-1 pl-2 border-l border-slate-700 whitespace-pre-wrap">
                      {log.details}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
