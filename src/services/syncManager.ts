import { AppsScriptProject, GitHubConfig, SyncLogEntry, SyncSettings } from '../types';
import { mergeProjectFiles, SyncConflictInfo } from './syncMerge';
import { loadCommits } from './gitService';
import { createCommit } from './gitService';
import { fetchAppsScriptProject } from './appsScriptService';
import { getOrCreateBackupFolder, saveSnapshotToDrive } from './googleDriveService';
import { pushFilesToGitHub } from './githubService';

export class SyncCoordinator {
  private countdownTimer: any = null;
  private secondsRemaining: number = 30;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;
  private onLogCallback?: (entry: SyncLogEntry) => void;
  private onStatusChangeCallback?: (status: {
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    countdown: number;
    activeScriptsCount?: number;
  }) => void;
  private onProjectUpdatedCallback?: (updatedProject: AppsScriptProject) => void;
  private onConflictCallback?: (info: SyncConflictInfo) => void;

  public setupListeners(
    onLog: (entry: SyncLogEntry) => void,
    onStatusChange: (status: {
      isSyncing: boolean;
      lastSyncedAt: Date | null;
      countdown: number;
      activeScriptsCount?: number;
    }) => void,
    onProjectUpdated?: (updatedProject: AppsScriptProject) => void,
    onConflict?: (info: SyncConflictInfo) => void
  ) {
    this.onLogCallback = onLog;
    this.onStatusChangeCallback = onStatusChange;
    this.onProjectUpdatedCallback = onProjectUpdated;
    this.onConflictCallback = onConflict;
  }

  private log(
    type: 'info' | 'success' | 'warning' | 'error',
    category: 'drive' | 'github' | 'git' | 'apps_script' | 'realtime',
    message: string,
    details?: string
  ) {
    if (this.onLogCallback) {
      this.onLogCallback({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type,
        category,
        message,
        details
      });
    }
  }

  public startAutoSync(
    projects: AppsScriptProject[],
    accessToken: string | null,
    settings: SyncSettings,
    gitHubConfig: GitHubConfig
  ) {
    this.stopAutoSync();
    if (!settings.autoSyncEnabled) return;

    this.secondsRemaining = settings.intervalSeconds;

    // Filter projects based on user's selectedScriptIds
    const targetProjects =
      settings.selectedScriptIds && settings.selectedScriptIds.length > 0
        ? projects.filter((p) => settings.selectedScriptIds.includes(p.scriptId))
        : projects;

    this.countdownTimer = setInterval(() => {
      this.secondsRemaining--;
      if (this.secondsRemaining <= 0) {
        this.secondsRemaining = settings.intervalSeconds;
        this.runMultiSync(projects, accessToken, settings, gitHubConfig, false);
      }
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback({
          isSyncing: this.isRunning,
          lastSyncedAt: null,
          countdown: this.secondsRemaining,
          activeScriptsCount: targetProjects.length
        });
      }
    }, 1000);

    this.log(
      'info',
      'realtime',
      `Служба авто-синхронизации активна (интервал: ${settings.intervalSeconds}с, скриптов выбрано: ${targetProjects.length})`
    );
  }

  public stopAutoSync() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  }

  public async runMultiSync(
    projects: AppsScriptProject[],
    accessToken: string | null,
    settings: SyncSettings,
    gitHubConfig: GitHubConfig,
    isManual: boolean = false
  ): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const targetProjects =
      settings.selectedScriptIds && settings.selectedScriptIds.length > 0
        ? projects.filter((p) => settings.selectedScriptIds.includes(p.scriptId))
        : projects;

    if (targetProjects.length === 0) {
      this.log(
        'warning',
        'realtime',
        'Нет выбранных скриптов для синхронизации. Проверьте настройки.'
      );
      this.isRunning = false;
      return;
    }

    try {
      this.log(
        'info',
        'realtime',
        isManual
          ? `Запуск ручной синхронизации для ${targetProjects.length} скрипт(ов)...`
          : `Фоновая проверка ${targetProjects.length} выбранных скриптов...`
      );

      // Determine Drive target folder ID
      let targetFolderId = settings.backupFolderId;
      if (settings.backupToDrive && accessToken && !targetFolderId) {
        try {
          targetFolderId = await getOrCreateBackupFolder(
            accessToken,
            settings.backupFolderName || 'ScriptVault_Backups'
          );
        } catch (e: any) {
          this.log(
            'error',
            'drive',
            `Не удалось инициализировать папку на Google Диске: ${e.message}`
          );
        }
      }

      for (const project of targetProjects) {
        if (signal.aborted) {
          this.log('warning', 'realtime', 'Синхронизация отменена пользователем');
          break;
        }
        await this.syncSingleProject(
          project,
          accessToken,
          settings,
          gitHubConfig,
          targetFolderId,
          isManual
        );
      }
    } finally {
      this.isRunning = false;
      this.abortController = null;
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback({
          isSyncing: false,
          lastSyncedAt: new Date(),
          countdown: this.secondsRemaining,
          activeScriptsCount: targetProjects.length
        });
      }
    }
  }

  /** Abort the running sync at the next safe point. */
  public cancelSync(): void {
    if (this.abortController && this.isRunning) {
      this.log('warning', 'realtime', 'Запрошена отмена синхронизации...');
      this.abortController.abort();
    }
  }

  private async syncSingleProject(
    project: AppsScriptProject,
    accessToken: string | null,
    settings: SyncSettings,
    gitHubConfig: GitHubConfig,
    targetFolderId?: string,
    isManual: boolean = false
  ) {
    let liveProject = project;

    // 1. Fetch live content from Google Apps Script if real script
    if (accessToken && !project.scriptId.startsWith('1DEMO_')) {
      try {
        const fresh = await fetchAppsScriptProject(project.scriptId, accessToken);
        liveProject = {
          ...fresh,
          parentTitle: project.parentTitle,
          lastSyncTime: new Date().toISOString(),
          lastSyncStatus: 'success'
        };

        // Three-way merge (local vs remote vs last commit) — never silently
        // overwrite files changed on both sides.
        const history = await loadCommits(liveProject.scriptId);
        const baselineFiles = history[0]?.files ?? null;
        const merge = mergeProjectFiles(project.files, liveProject.files, baselineFiles);
        if (merge.conflicts.length > 0) {
          this.log(
            'warning',
            'apps_script',
            `[${project.title}] Конфликт синхронизации (файлы изменены и локально, и в Apps Script): ${merge.conflicts.join(', ')}. Скрипт пропущен до разрешения конфликта.`
          );
          if (this.onConflictCallback) {
            this.onConflictCallback({
              localProject: project,
              remoteProject: liveProject,
              baselineFiles,
              conflictedFiles: merge.conflicts
            });
          }
          return;
        }
        liveProject = { ...liveProject, files: merge.files };
        if (this.onProjectUpdatedCallback) {
          this.onProjectUpdatedCallback(liveProject);
        }
      } catch (fetchErr: any) {
        this.log(
          'warning',
          'apps_script',
          `[${project.title}] Ошибка опроса Apps Script API: ${fetchErr.message}`
        );
      }
    }

    // 2. Git Engine: check and commit changes
    const commit = await createCommit(
      liveProject.scriptId,
      liveProject.files,
      isManual
        ? `Manual snapshot of ${liveProject.title}`
        : `Auto-backup snapshot: ${liveProject.title}`,
      'ScriptVault AutoSync',
      'main',
      { force: isManual }
    );

    if (commit) {
      this.log(
        'success',
        'git',
        `[${liveProject.title}] Создан Git-коммит ${commit.id}: ${commit.message} (${commit.summary?.filesChanged || 1} файлов)`
      );

      // 3. Backup to Google Drive
      if (settings.backupToDrive && accessToken && targetFolderId) {
        try {
          const fileName = `${liveProject.title.replace(/\s+/g, '_')}_commit_${commit.id}_${Date.now()}.json`;
          const snapshotData = {
            scriptId: liveProject.scriptId,
            title: liveProject.title,
            parentTitle: liveProject.parentTitle,
            parentId: liveProject.parentId,
            commitId: commit.id,
            timestamp: new Date().toISOString(),
            files: liveProject.files
          };

          await saveSnapshotToDrive(
            accessToken,
            targetFolderId,
            fileName,
            snapshotData,
            `ScriptVault backup commit ${commit.id}`
          );

          this.log(
            'success',
            'drive',
            `[${liveProject.title}] Снимок сохранен на Google Диск (файл: ${fileName})`
          );
        } catch (driveErr: any) {
          this.log(
            'error',
            'drive',
            `[${liveProject.title}] Ошибка загрузки на Google Диск: ${driveErr.message}`
          );
        }
      }

      // 4. Push to GitHub if configured
      if (
        settings.backupToGitHub &&
        gitHubConfig.connected &&
        gitHubConfig.token &&
        gitHubConfig.owner &&
        gitHubConfig.repo
      ) {
        try {
          const subPath = gitHubConfig.path
            ? `${gitHubConfig.path}/${liveProject.title.replace(/\s+/g, '_')}`
            : liveProject.title.replace(/\s+/g, '_');

          const pushResult = await pushFilesToGitHub(
            gitHubConfig.token,
            gitHubConfig.owner,
            gitHubConfig.repo,
            gitHubConfig.branch || 'main',
            liveProject.files,
            `Backup: ${commit.id} - ${liveProject.title} [ScriptVault]`,
            subPath
          );

          this.log(
            'success',
            'github',
            `[${liveProject.title}] Изменения отправлены на GitHub (${gitHubConfig.owner}/${gitHubConfig.repo} @ ${pushResult.commitSha.slice(0, 7)})`
          );
        } catch (ghErr: any) {
          this.log(
            'error',
            'github',
            `[${liveProject.title}] Ошибка отправки на GitHub: ${ghErr.message}`
          );
        }
      }
    } else if (isManual) {
      this.log('info', 'git', `[${liveProject.title}] Изменений не обнаружено. Код актуален.`);
    }
  }
}

export const syncCoordinator = new SyncCoordinator();
