export interface ScriptFile {
  name: string;
  type: 'SERVER_JS' | 'HTML' | 'JSON' | 'ENUM';
  source: string;
}

export interface AppsScriptProject {
  scriptId: string;
  title: string;
  parentId?: string; // e.g. Spreadsheet ID
  parentTitle?: string;
  files: ScriptFile[];
  lastModified?: string;
  version?: number;
  enabledForSync?: boolean;
  lastSyncStatus?: 'success' | 'error' | 'idle' | 'syncing';
  lastSyncTime?: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  iconLink?: string;
  webViewLink?: string;
  owners?: { displayName: string; emailAddress: string }[];
}

export interface DriveFolder {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
}

export interface GitCommit {
  id: string; // 7-40 char sha hash
  message: string;
  author: string;
  timestamp: number;
  parentId?: string;
  branch: string;
  files: ScriptFile[];
  summary?: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
  syncedToDrive?: boolean;
  syncedToGitHub?: boolean;
  gitHubCommitSha?: string;
}

export interface GitBranch {
  name: string;
  commitId: string;
  isDefault?: boolean;
}

export interface DriveBackupSnapshot {
  fileId: string;
  fileName: string;
  createdTime: string;
  scriptId: string;
  scriptTitle: string;
  commitId?: string;
  sizeBytes?: number;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  autoPush: boolean;
  connected: boolean;
}

export interface SyncSettings {
  autoSyncEnabled: boolean;
  intervalSeconds: number; // e.g. 10, 30, 60, 300, 3600
  backupToDrive: boolean;
  backupToGitHub: boolean;
  backupFolderId?: string;
  backupFolderName: string;
  backupSpreadsheetCopies: boolean;
  selectedScriptIds: string[]; // List of script IDs selected for sync
  syncFrequencyMode?: 'seconds' | 'minutes' | 'hours' | 'manual';
}

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'drive' | 'github' | 'git' | 'apps_script' | 'realtime';
  message: string;
  details?: string;
}
