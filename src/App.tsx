/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect } from 'react';
import { syncCoordinator } from './services/syncManager';
import { useAppStore } from './store/appStore';
import { Navbar } from './components/Navbar';
import { SpreadsheetPicker } from './components/SpreadsheetPicker';
import { CodeWorkspace } from './components/CodeWorkspace';
import { GitHistory } from './components/GitHistory';
import { GitHubPanel } from './components/GitHubPanel';
import { BackupDrivePanel } from './components/BackupDrivePanel';
import { ActivityLog } from './components/ActivityLog';
import { ProjectEmptyState } from './components/ProjectEmptyState';

export default function App() {
  const activeTab = useAppStore((s) => s.activeTab);
  const currentProject = useAppStore((s) => s.currentProject);

  // slices that drive the auto-sync watcher (mirrors the former effect deps)
  const autoSyncEnabled = useAppStore((s) => s.syncSettings.autoSyncEnabled);
  const intervalSeconds = useAppStore((s) => s.syncSettings.intervalSeconds);
  const backupToDrive = useAppStore((s) => s.syncSettings.backupToDrive);
  const backupToGitHub = useAppStore((s) => s.syncSettings.backupToGitHub);
  const backupFolderId = useAppStore((s) => s.syncSettings.backupFolderId);
  const backupFolderName = useAppStore((s) => s.syncSettings.backupFolderName);
  const selectedScriptIds = useAppStore((s) => s.syncSettings.selectedScriptIds);
  const projectsCount = useAppStore((s) => s.allProjects.length);
  const accessToken = useAppStore((s) => s.accessToken);
  const ghConnected = useAppStore((s) => s.gitHubConfig.connected);
  const ghAutoPush = useAppStore((s) => s.gitHubConfig.autoPush);

  // auth listener + sync coordinator wiring (once)
  useEffect(() => {
    const { initAuthListener, createInitialCommits, initSyncCoordinator } = useAppStore.getState();
    const unsubscribe = initAuthListener();
    createInitialCommits();
    initSyncCoordinator();
    return unsubscribe;
  }, []);

  // start/stop auto-sync watcher
  useEffect(() => {
    useAppStore.getState().applyAutoSync();
    return () => syncCoordinator.stopAutoSync();
  }, [
    projectsCount,
    accessToken,
    autoSyncEnabled,
    intervalSeconds,
    backupToDrive,
    backupToGitHub,
    backupFolderId,
    backupFolderName,
    selectedScriptIds,
    ghConnected,
    ghAutoPush
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600/40">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'workspace' &&
          (currentProject ? <CodeWorkspace /> : <ProjectEmptyState />)}

        {activeTab === 'sheets' && <SpreadsheetPicker />}
        {activeTab === 'git' && <GitHistory />}
        {activeTab === 'github' && <GitHubPanel />}
        {activeTab === 'drive' && <BackupDrivePanel />}
        {activeTab === 'logs' && <ActivityLog />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">ScriptVault</span>
            <span>—</span>
            <span>Google Apps Script Sync, Google Drive Backup & GitHub Version Control</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Google Drive API v3</span>
            <span>•</span>
            <span>Google Apps Script REST API v1</span>
            <span>•</span>
            <span>GitHub REST & Git Data API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
