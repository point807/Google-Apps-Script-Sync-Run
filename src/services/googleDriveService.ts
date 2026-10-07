import { apiFetch } from './http';
import { GoogleDriveFile, DriveBackupSnapshot, DriveFolder } from '../types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export const listGoogleDriveFolders = async (
  accessToken: string,
  searchQuery: string = ''
): Promise<DriveFolder[]> => {
  let query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  if (searchQuery.trim()) {
    query += ` and name contains '${searchQuery.replace(/'/g, "\\'")}'`;
  }

  const url = new URL(`${DRIVE_API_BASE}/files`);
  url.searchParams.append('q', query);
  url.searchParams.append('pageSize', '50');
  url.searchParams.append('fields', 'files(id, name, createdTime, modifiedTime)');
  url.searchParams.append('orderBy', 'name asc');

  const res = await apiFetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to list folders: ${res.statusText}`);
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime
  }));
};

export const createCustomDriveFolder = async (
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<DriveFolder> => {
  const body: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    description: 'Apps Script backup folder managed by ScriptVault'
  };
  if (parentFolderId) {
    body.parents = [parentFolderId];
  }

  const res = await apiFetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Failed to create folder: ${res.statusText}`);
  }

  const created = await res.json();
  return {
    id: created.id,
    name: created.name
  };
};

export const listGoogleSpreadsheets = async (
  accessToken: string,
  searchQuery: string = ''
): Promise<GoogleDriveFile[]> => {
  let query = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
  if (searchQuery.trim()) {
    query += ` and name contains '${searchQuery.replace(/'/g, "\\'")}'`;
  }

  const url = new URL(`${DRIVE_API_BASE}/files`);
  url.searchParams.append('q', query);
  url.searchParams.append('pageSize', '30');
  url.searchParams.append(
    'fields',
    'files(id, name, mimeType, modifiedTime, iconLink, webViewLink, owners)'
  );
  url.searchParams.append('orderBy', 'modifiedTime desc');

  let res: Response;
  try {
    res = await apiFetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch (netErr: any) {
    throw new Error(
      `Сетевая ошибка при загрузке таблиц с Google Диска (${netErr.message || 'Failed to fetch'}).\n` +
        `Если у вас активен AdBlock или Brave Shield, разрешите запросы к *.googleapis.com, либо обновите вход через Google.`,
      { cause: netErr }
    );
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to list spreadsheets: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return data.files || [];
};

export const listGoogleScripts = async (
  accessToken: string,
  searchQuery: string = ''
): Promise<GoogleDriveFile[]> => {
  let query = "mimeType = 'application/vnd.google-apps.script' and trashed = false";
  if (searchQuery.trim()) {
    query += ` and name contains '${searchQuery.replace(/'/g, "\\'")}'`;
  }

  const url = new URL(`${DRIVE_API_BASE}/files`);
  url.searchParams.append('q', query);
  url.searchParams.append('pageSize', '30');
  url.searchParams.append(
    'fields',
    'files(id, name, mimeType, modifiedTime, iconLink, webViewLink, owners)'
  );
  url.searchParams.append('orderBy', 'modifiedTime desc');

  let res: Response;
  try {
    res = await apiFetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch (netErr: any) {
    throw new Error(
      `Сетевая ошибка при загрузке скриптов с Google Диска (${netErr.message || 'Failed to fetch'}).\n` +
        `Проверьте подключение к сети или обновите вход через Google.`,
      { cause: netErr }
    );
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to list scripts: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return data.files || [];
};

export const getOrCreateBackupFolder = async (
  accessToken: string,
  folderName: string = 'ScriptVault_Backups'
): Promise<string> => {
  // Check if folder exists
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
  const url = new URL(`${DRIVE_API_BASE}/files`);
  url.searchParams.append('q', query);
  url.searchParams.append('fields', 'files(id, name)');

  const res = await apiFetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (res.ok) {
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder if not found
  const createRes = await apiFetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Automated Apps Script and Spreadsheet backups managed by ScriptVault'
    })
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create backup folder: ${createRes.statusText}`);
  }

  const newFolder = await createRes.json();
  return newFolder.id;
};

export const saveSnapshotToDrive = async (
  accessToken: string,
  folderId: string,
  fileName: string,
  content: object | string,
  description?: string
): Promise<string> => {
  const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const metadata = {
    name: fileName,
    parents: [folderId],
    description: description || 'ScriptVault Auto-Backup Snapshot'
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const res = await apiFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload snapshot to Drive: ${res.status} ${err}`);
  }

  const createdFile = await res.json();
  return createdFile.id;
};

export const copySpreadsheetBackup = async (
  accessToken: string,
  spreadsheetId: string,
  backupName: string,
  destinationFolderId?: string
): Promise<string> => {
  const body: any = {
    name: backupName
  };
  if (destinationFolderId) {
    body.parents = [destinationFolderId];
  }

  const res = await apiFetch(`${DRIVE_API_BASE}/files/${spreadsheetId}/copy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Failed to copy spreadsheet: ${res.statusText}`);
  }

  const copied = await res.json();
  return copied.id;
};

export const listDriveSnapshots = async (
  accessToken: string,
  folderId: string
): Promise<DriveBackupSnapshot[]> => {
  const query = `'${folderId}' in parents and trashed = false`;
  const url = new URL(`${DRIVE_API_BASE}/files`);
  url.searchParams.append('q', query);
  url.searchParams.append('fields', 'files(id, name, createdTime, size, description)');
  url.searchParams.append('orderBy', 'createdTime desc');
  url.searchParams.append('pageSize', '50');

  const res = await apiFetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) return [];

  const data = await res.json();
  const snapshots: DriveBackupSnapshot[] = (data.files || []).map((f: any) => ({
    fileId: f.id,
    fileName: f.name,
    createdTime: f.createdTime,
    scriptId: '',
    scriptTitle: f.name.replace(/\.json$/, ''),
    sizeBytes: f.size ? Number(f.size) : undefined
  }));

  return snapshots;
};

export const downloadDriveFileContent = async (
  accessToken: string,
  fileId: string
): Promise<string> => {
  const res = await apiFetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.statusText}`);
  }

  return await res.text();
};
