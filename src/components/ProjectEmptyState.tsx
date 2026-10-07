/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { FolderGit2, Sparkles, Plug } from 'lucide-react';

interface ProjectEmptyStateProps {
  lang: 'ru' | 'en';
  onLoadDemo: () => void;
  onGoConnect: () => void;
}

export const ProjectEmptyState: React.FC<ProjectEmptyStateProps> = ({
  lang,
  onLoadDemo,
  onGoConnect,
}) => {
  const t = {
    ru: {
      title: 'Проект ещё не подключён',
      description:
        'Подключите Google Apps Script проект по ID или URL, выберите скрипт из Google Drive или загрузите демо-проекты, чтобы посмотреть, как работает приложение.',
      connect: 'Подключить проект',
      demo: 'Загрузить демо',
    },
    en: {
      title: 'No project connected yet',
      description:
        'Connect a Google Apps Script project by ID or URL, pick a script from Google Drive, or load the demo projects to see how the app works.',
      connect: 'Connect a project',
      demo: 'Load demo',
    },
  }[lang];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 shadow-xl text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
        <FolderGit2 className="w-7 h-7 text-indigo-400" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-white tracking-tight">{t.title}</h2>
      <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">{t.description}</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={onGoConnect}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          <Plug className="w-4 h-4" />
          {t.connect}
        </button>
        <button
          onClick={onLoadDemo}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors border border-slate-700"
        >
          <Sparkles className="w-4 h-4" />
          {t.demo}
        </button>
      </div>
    </div>
  );
};
