/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useAppStore } from '../store/appStore';

export type Lang = 'ru' | 'en';

/** Central translation catalog, one namespace per UI area. */
export const messages = {
  ru: {
    nav: {
      appName: 'ScriptVault',
      tagline: 'Apps Script Sync & Git',
      tabs: {
        workspace: 'Код и Скрипты',
        sheets: 'Таблицы Sheets',
        git: 'История Git',
        github: 'GitHub',
        drive: 'Настройки и Диск',
        logs: 'Журнал событий'
      },
      signIn: 'Войти через Google',
      signingIn: 'Вход...',
      liveWatcher: 'Синхронизация через',
      syncNow: 'Синхронизировать',
      syncing: 'Синхронизация...',
      cancelSync: 'Отменить синхронизацию',
      justNow: 'только что',
      connectedDrive: 'Диск подключен',
      connectedGH: 'GitHub активен'
    },
    activity: {
      title: 'Журнал активности и синхронизации',
      subtitle: 'История всех операций Google Диска, Git, GitHub и мониторинга в реальном времени',
      clear: 'Очистить журнал',
      export: 'Экспорт журнала',
      noLogs: 'Записей в журнале пока нет. Они будут появляться по мере работы системы.',
      all: 'Все категории'
    },
    backup: {
      title: 'Настройки синхронизации и Google Диск',
      subtitle: 'Выбор папки на Диске, частота авто-синхронизации и выбор отслеживаемых скриптов',
      folderSection: '1. Папка резервного копирования на Google Диске',
      currentFolder: 'Текущая выбранная папка:',
      changeFolderBtn: 'Выбрать / Изменить папку',
      createNewFolderBtn: 'Создать новую папку',
      frequencySection: '2. Частота автоматической синхронизации',
      autoSyncToggle: 'Автоматическая синхронизация изменений в реальном времени',
      intervalPresetLabel: 'Предустановленные интервалы:',
      customIntervalLabel: 'Или задайте интервал вручную (в секундах):',
      applyInterval: 'Применить',
      scriptsSection: '3. Выбор скриптов для синхронизации',
      scriptsSubtitle:
        'Отметьте скрипты, которые должны автоматически проверяться и сохраняться на Google Диск:',
      selectAll: 'Выбрать все',
      deselectAll: 'Снять все',
      selectedCount: 'Выбрано для синхронизации:',
      backupNowBtn: 'Синхронизировать выбранные скрипты сейчас',
      syncingBtn: 'Синхронизация...',
      snapshotsSection: 'Снимки резервных копий в текущей папке',
      refreshSnapshots: 'Обновить список',
      noSnapshots: 'В выбранной папке пока нет файлов снимков.',
      restoreBtn: 'Восстановить',
      restoreModalTitle: 'Восстановить из снимка?',
      restoreModalDesc:
        'Файлы текущего проекта будут заменены содержимым снимка. В локальной истории Git будет создан коммит восстановления (откат возможен).',
      restoreDeployLabel:
        'Также загрузить восстановленный код в Google Apps Script (перезапишет удаленный скрипт)',
      restoreConfirmBtn: 'Восстановить',
      restoringBtn: 'Восстановление...',
      browseModalTitle: 'Выбор папки на Google Диске',
      folderSearchPlaceholder: 'Поиск папок по названию...',
      selectFolderBtn: 'Выбрать эту папку',
      createFolderTitle: 'Создать новую папку на Диске:',
      folderNamePlaceholder: 'Например, AppsScript_Backups_2026',
      createFolderAction: 'Создать и выбрать',
      close: 'Закрыть',
      noDriveToken: 'Для доступа к Google Диску выполните вход в аккаунт Google в верхней панели.'
    },
    code: {
      downloadZip: 'Скачать ZIP архив',
      downloadFile: 'Скачать текущий файл',
      pushToScript: 'Отправить в Apps Script',
      pushWarning: 'Внимание: это действие обновит код проекта в Google Apps Script!',
      commitSnapshot: 'Зафиксировать в Git',
      addFile: 'Добавить файл',
      deleteFile: 'Удалить файл',
      fileNamePlaceholder: 'Название файла (например, DatabaseHelper)',
      createFileBtn: 'Создать файл',
      cancel: 'Отмена',
      editorTitle: 'Редактор кода проекта',
      openInEditor: 'Открыть в Apps Script Editor',
      lines: 'строк',
      chars: 'симв.',
      boundTo: 'Привязано к таблице:',
      pushSuccess: 'Код успешно развернут в Google Apps Script!',
      commitModalTitle: 'Создание нового Git-коммита',
      commitMessagePlaceholder: 'Краткое описание внесенных изменений...',
      createCommitBtn: 'Зафиксировать коммит'
    },
    history: {
      title: 'Система контроля версий Git',
      subtitle:
        'Просмотр истории коммитов для каждого скрипта, автора, даты, сообщений и функции отката',
      scriptSelectorLabel: 'Выберите скрипт для просмотра истории:',
      branch: 'Ветка:',
      noCommits: 'Для выбранного скрипта пока нет истории коммитов.',
      noCommitsDesc:
        'Коммиты формируются автоматически при авто-синхронизации или при ручной фиксации изменений.',
      filesChanged: 'файлов изменено',
      additions: 'добавлено',
      deletions: 'удалено',
      syncedDrive: 'Google Диск',
      syncedGH: 'GitHub',
      viewDiff: 'Посмотреть изменения (Diff)',
      downloadZip: 'Скачать ZIP снимка',
      rollbackBtn: 'Откатить к этому коммиту',
      rollbackTitle: 'Откат версии кода к выбранному коммиту',
      rollbackDesc: (commitId: string, msg: string) =>
        `Вы собираетесь вернуть проект к коммиту ${commitId} ("${msg}"). Текущие файлы рабочего пространства будут заменены состоянием из этого коммита.`,
      deployCheckbox: 'Также немедленно развернуть (перезаписать) в Google Apps Script',
      deployNotice:
        'Внимание: перезапись кода в Google Apps Script обновит скрипт на серверах Google!',
      confirmRollbackAction: 'Подтвердить откат',
      cancel: 'Отмена',
      diffModalTitle: 'Сравнение изменений с предыдущей версией',
      close: 'Закрыть',
      authorLabel: 'Автор:',
      dateLabel: 'Дата и время:',
      messageLabel: 'Сообщение:',
      shaLabel: 'SHA:',
      headBadge: 'HEAD (Текущая версия)',
      filesInCommit: 'Файлы в этом коммите:'
    },
    github: {
      title: 'Интеграция с GitHub',
      subtitle:
        'Подключение удаленного репозитория GitHub, управление ветками, синхронизация и резервное копирование',
      tokenLabel: 'GitHub Personal Access Token (PAT):',
      tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxx',
      connectBtn: 'Подключить GitHub',
      disconnectBtn: 'Отключить',
      connectedAs: 'Подключен как:',
      tokenHelp:
        'Для работы требуется токен с разрешением "repo". Создайте его на GitHub: Settings → Developer Settings → Personal access tokens (classic) → Generate token (выберите scope: repo).',
      repoSection: 'Настройки репозитория GitHub',
      selectRepo: 'Выберите репозиторий:',
      createRepoBtn: 'Создать новый репозиторий',
      branchSectionTitle: 'Управление ветками репозитория (Branches)',
      activeBranchLabel: 'Текущая активная ветка:',
      createBranchBtn: 'Создать новую ветку',
      refreshBranches: 'Обновить ветки',
      switchBranchBtn: 'Переключить',
      deleteBranchBtn: 'Удалить ветку',
      pathLabel: 'Папка в репозитории (оставьте пустым для корня):',
      autoPushToggle: 'Автоматически отправлять в GitHub при каждой резервной копии',
      pushNowBtn: 'Отправить текущий код в GitHub',
      pushing: 'Отправка на GitHub...',
      recentCommitsTitle: 'Последние коммиты в репозитории GitHub:',
      noRemoteCommits: 'Нет истории коммитов или репозиторий еще не инициализирован.',
      refreshCommits: 'Обновить историю',
      createModalTitle: 'Создание нового репозитория на GitHub',
      repoNamePlaceholder: 'my-apps-script-project',
      privateOption: 'Приватный репозиторий (рекомендуется)',
      createBtn: 'Создать',
      cancel: 'Отмена',
      createBranchModalTitle: 'Создание новой ветки на GitHub',
      branchNamePlaceholder: 'feature/sheet-sync или v1.1',
      baseBranchLabel: 'Создать ответвление от:',
      createBranchAction: 'Создать ветку',
      deleteBranchConfirmTitle: 'Удалить ветку на GitHub?',
      deleteBranchConfirmDesc: (branch: string, repo: string) =>
        `Вы уверены, что хотите удалить ветку "${branch}" из репозитория ${repo}? Это действие нельзя отменить.`,
      cannotDeleteActive: 'Нельзя удалить активную или защищенную ветку'
    },
    sheets: {
      title: 'Google Таблицы и Apps Script',
      subtitle:
        'Подключение таблиц со встроенным кодом или автономных проектов Apps Script из вашего Google Диска',
      tabs: {
        spreadsheets: 'Таблицы Google Sheets',
        scripts: 'Автономные Apps Script',
        manual: 'Ввести ссылку / ID'
      },
      searchPlaceholder: 'Поиск по названию файлов...',
      refresh: 'Обновить список',
      demoTemplates: 'Готовые шаблоны скриптов для тестирования:',
      noFilesFound: 'Файлы не найдены в вашем Google Диске.',
      connectGoogleMsg:
        'Войдите через Google в шапке сайта, чтобы просмотреть файлы с вашего Google Диска.',
      currentActive: 'Текущий активный проект:',
      loadProject: 'Загрузить скрипт',
      connectScript: 'Подключить Apps Script',
      loadingScript: 'Загрузка...',
      openInSheets: 'Открыть в Sheets',
      openInDrive: 'Диск',
      exportSheet: 'Копия на Диске',
      exporting: 'Копирование...',
      customLabel: 'Вставьте ссылку на проект Apps Script или его Script ID:',
      customHelper:
        'Примеры:\n• https://script.google.com/home/projects/1abc.../edit\n• ID скрипта: 1aB2cD3eF4...',
      fetchBtn: 'Получить код скрипта',
      boundScriptNotice:
        'Важно: идентификатор Google Таблицы отличается от Script ID прикрепленного к ней скрипта.'
    }
  },
  en: {
    nav: {
      appName: 'ScriptVault',
      tagline: 'Apps Script Sync & Git',
      tabs: {
        workspace: 'Code & Scripts',
        sheets: 'Google Sheets',
        git: 'Git History',
        github: 'GitHub',
        drive: 'Sync & Drive',
        logs: 'Event Log'
      },
      signIn: 'Sign in with Google',
      signingIn: 'Signing in...',
      liveWatcher: 'Sync in',
      syncNow: 'Sync Now',
      syncing: 'Syncing...',
      cancelSync: 'Cancel sync',
      justNow: 'just now',
      connectedDrive: 'Drive Connected',
      connectedGH: 'GitHub Active'
    },
    activity: {
      title: 'Live Activity & Sync Log',
      subtitle:
        'Full audit log of Drive snapshots, Git commits, GitHub pushes, and real-time watcher events',
      clear: 'Clear Log',
      export: 'Export Log',
      noLogs: 'No log entries recorded yet.',
      all: 'All Categories'
    },
    backup: {
      title: 'Sync Settings & Google Drive',
      subtitle: 'Folder selection on Drive, frequency configuration, and target script selection',
      folderSection: '1. Google Drive Backup Folder',
      currentFolder: 'Currently selected folder:',
      changeFolderBtn: 'Browse / Change Folder',
      createNewFolderBtn: 'Create New Folder',
      frequencySection: '2. Automatic Synchronization Frequency',
      autoSyncToggle: 'Automatic real-time changes synchronization',
      intervalPresetLabel: 'Preset intervals:',
      customIntervalLabel: 'Or enter custom interval (in seconds):',
      applyInterval: 'Apply',
      scriptsSection: '3. Select Scripts to Synchronize',
      scriptsSubtitle:
        'Check the scripts that should be automatically tracked and backed up to Google Drive:',
      selectAll: 'Select All',
      deselectAll: 'Deselect All',
      selectedCount: 'Selected for sync:',
      backupNowBtn: 'Sync Selected Scripts Now',
      syncingBtn: 'Syncing...',
      snapshotsSection: 'Backup Snapshots in Current Folder',
      refreshSnapshots: 'Refresh Snapshots',
      noSnapshots: 'No snapshot files found in the selected folder yet.',
      restoreBtn: 'Restore',
      restoreModalTitle: 'Restore from snapshot?',
      restoreModalDesc:
        'Current project files will be replaced with the snapshot content. A restore commit will be created in local Git history (reversible).',
      restoreDeployLabel:
        'Also push restored code to Google Apps Script (overwrites the remote script)',
      restoreConfirmBtn: 'Restore',
      restoringBtn: 'Restoring...',
      browseModalTitle: 'Select Google Drive Folder',
      folderSearchPlaceholder: 'Search folders by name...',
      selectFolderBtn: 'Select this folder',
      createFolderTitle: 'Create New Folder on Drive:',
      folderNamePlaceholder: 'e.g., AppsScript_Backups_2026',
      createFolderAction: 'Create & Select',
      close: 'Close',
      noDriveToken: 'Sign in with Google in the top bar to access Drive folders.'
    },
    code: {
      downloadZip: 'Download .ZIP Archive',
      downloadFile: 'Download Current File',
      pushToScript: 'Push to Apps Script',
      pushWarning: 'Warning: this will update the live code in Google Apps Script!',
      commitSnapshot: 'Commit to Git',
      addFile: 'New File',
      deleteFile: 'Delete File',
      fileNamePlaceholder: 'File name (e.g., DatabaseHelper)',
      createFileBtn: 'Create File',
      cancel: 'Cancel',
      editorTitle: 'Project Code Workspace',
      openInEditor: 'Open in Apps Script Editor',
      lines: 'lines',
      chars: 'chars',
      boundTo: 'Bound to spreadsheet:',
      pushSuccess: 'Code successfully deployed to Google Apps Script!',
      commitModalTitle: 'Create New Git Commit',
      commitMessagePlaceholder: 'Short description of your changes...',
      createCommitBtn: 'Commit Changes'
    },
    history: {
      title: 'Git Version Control System',
      subtitle:
        'Inspect commit history per script including author, timestamp, message, and rollback',
      scriptSelectorLabel: 'Select script to view commit history:',
      branch: 'Branch:',
      noCommits: 'No commits found for the selected script yet.',
      noCommitsDesc:
        'Commits are recorded automatically during auto-sync or when creating manual snapshots.',
      filesChanged: 'files changed',
      additions: 'additions',
      deletions: 'deletions',
      syncedDrive: 'Google Drive',
      syncedGH: 'GitHub',
      viewDiff: 'Inspect Diff',
      downloadZip: 'Download ZIP snapshot',
      rollbackBtn: 'Rollback to this commit',
      rollbackTitle: 'Rollback Code Version to Selected Commit',
      rollbackDesc: (commitId: string, msg: string) =>
        `You are about to revert the project back to commit ${commitId} ("${msg}"). Workspace files will be overwritten with this snapshot.`,
      deployCheckbox: 'Also immediately deploy (overwrite) to Google Apps Script remotely',
      deployNotice:
        'Caution: overwriting code in Google Apps Script updates code directly on Google servers!',
      confirmRollbackAction: 'Confirm Rollback',
      cancel: 'Cancel',
      diffModalTitle: 'Changes Diff against parent commit',
      close: 'Close',
      authorLabel: 'Author:',
      dateLabel: 'Timestamp:',
      messageLabel: 'Message:',
      shaLabel: 'SHA:',
      headBadge: 'HEAD (Current Version)',
      filesInCommit: 'Files in this commit:'
    },
    github: {
      title: 'GitHub Integration',
      subtitle: 'Connect remote GitHub repository, manage branches, sync, and backup code',
      tokenLabel: 'GitHub Personal Access Token (PAT):',
      tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxx',
      connectBtn: 'Connect GitHub',
      disconnectBtn: 'Disconnect',
      connectedAs: 'Connected as:',
      tokenHelp:
        'Requires a token with "repo" scope. Generate one at: GitHub → Settings → Developer Settings → Personal access tokens → Generate new token (classic).',
      repoSection: 'GitHub Repository Settings',
      selectRepo: 'Select target repository:',
      createRepoBtn: 'Create New Repository',
      branchSectionTitle: 'Repository Branch Management',
      activeBranchLabel: 'Active branch for sync:',
      createBranchBtn: 'New Branch',
      refreshBranches: 'Refresh branches',
      switchBranchBtn: 'Switch',
      deleteBranchBtn: 'Delete branch',
      pathLabel: 'Folder path (leave empty for root):',
      autoPushToggle: 'Automatically push to GitHub on every backup snapshot',
      pushNowBtn: 'Push Current Code to GitHub',
      pushing: 'Pushing to GitHub...',
      recentCommitsTitle: 'Recent commits on remote GitHub repository:',
      noRemoteCommits: 'No remote commit history found or repository is empty.',
      refreshCommits: 'Refresh remote commits',
      createModalTitle: 'Create New GitHub Repository',
      repoNamePlaceholder: 'my-apps-script-project',
      privateOption: 'Private repository (recommended)',
      createBtn: 'Create Repository',
      cancel: 'Cancel',
      createBranchModalTitle: 'Create New Branch on GitHub',
      branchNamePlaceholder: 'feature/sheet-sync or v1.1',
      baseBranchLabel: 'Branch from base:',
      createBranchAction: 'Create Branch',
      deleteBranchConfirmTitle: 'Delete branch on GitHub?',
      deleteBranchConfirmDesc: (branch: string, repo: string) =>
        `Are you sure you want to delete branch "${branch}" in repository ${repo}? This action cannot be undone.`,
      cannotDeleteActive: 'Cannot delete active or protected branch'
    },
    sheets: {
      title: 'Google Sheets & Apps Script',
      subtitle:
        'Connect spreadsheets with bound code or standalone Apps Script projects from Google Drive',
      tabs: {
        spreadsheets: 'Google Spreadsheets',
        scripts: 'Standalone Scripts',
        manual: 'Direct URL / Script ID'
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
      customHelper:
        'Examples:\n• https://script.google.com/home/projects/1abc.../edit\n• Script ID: 1aB2cD3eF4...',
      fetchBtn: 'Fetch Project Code',
      boundScriptNotice:
        'Important: A spreadsheet ID is different from the Script ID of its attached Apps Script.'
    }
  }
};

export type Messages = typeof messages;

/** Returns the translation catalog for one UI area (namespace). */
export function useT<K extends keyof Messages[Lang]>(ns: K): Messages[Lang][K] {
  const lang = useAppStore((s) => s.lang);
  return messages[lang][ns];
}
