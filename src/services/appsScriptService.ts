import { apiFetch } from './http';
import JSZip from 'jszip';
import { AppsScriptProject, ScriptFile } from '../types';

const SCRIPT_API_BASE = 'https://script.googleapis.com/v1';

export const extractScriptId = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();

  // Match Apps Script URLs with optional multi-account prefix (/u/0/, /u/1/, etc.)
  // Examples:
  // https://script.google.com/home/projects/1abc-def/edit
  // https://script.google.com/u/0/home/projects/1abc-def/edit
  // https://script.google.com/d/1abc-def/edit
  // https://script.google.com/u/1/d/1abc-def/edit
  // https://script.google.com/macros/d/1abc-def/edit
  const scriptUrlMatch = trimmed.match(
    /script\.google\.com(?:\/u\/\d+)?\/(?:home\/projects|macros\/d|d)\/([a-zA-Z0-9_-]+)/i
  );
  if (scriptUrlMatch && scriptUrlMatch[1]) return scriptUrlMatch[1];

  // Match Drive file link for scripts
  // https://drive.google.com/file/d/1abc-def/view
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (driveFileMatch && driveFileMatch[1]) return driveFileMatch[1];

  // If user pasted a bare alphanumeric script ID (typically 20-80 characters)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  // Extract long alphanumeric sequence if it looks like an ID
  const anyIdMatch = trimmed.match(/([a-zA-Z0-9_-]{25,})/);
  if (anyIdMatch && anyIdMatch[1]) return anyIdMatch[1];

  return trimmed;
};

export const extractSpreadsheetId = (input: string): string | null => {
  const trimmed = input.trim();
  const match = trimmed.match(/docs\.google\.com\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
};

export const fetchAppsScriptProject = async (
  scriptId: string,
  accessToken: string
): Promise<AppsScriptProject> => {
  const cleanScriptId = extractScriptId(scriptId);

  // Validate cleanScriptId
  if (
    !cleanScriptId ||
    cleanScriptId.includes('/') ||
    cleanScriptId.includes(':') ||
    cleanScriptId.length < 10
  ) {
    throw new Error(
      `Некорректный идентификатор скрипта: "${scriptId}".\n` +
        `Пожалуйста, укажите ссылку на редактор Apps Script (например, https://script.google.com/home/projects/.../edit) или Script ID из настроек проекта (⚙️).`
    );
  }

  // 1. Fetch metadata
  let title = 'Google Apps Script';
  let parentId: string | undefined = undefined;

  try {
    const metaRes = await apiFetch(`${SCRIPT_API_BASE}/projects/${cleanScriptId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      title = meta.title || title;
      parentId = meta.parentId;
    }
  } catch (e) {
    console.warn('Could not fetch project metadata directly:', e);
  }

  // 2. Fetch project files content
  let contentRes: Response;
  try {
    contentRes = await apiFetch(`${SCRIPT_API_BASE}/projects/${cleanScriptId}/content`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch (netErr: any) {
    throw new Error(
      `Сетевая ошибка при обращении к Apps Script API (${netErr.message || 'Failed to fetch'}).\n\n` +
        `Возможные причины:\n` +
        `1. В браузере включен блокировщик (AdBlock, uBlock, Brave Shields), блокирующий запросы к *.googleapis.com. Попробуйте временно отключить его для этого сайта.\n` +
        `2. Сессия авторизации Google устарела — нажмите «Выйти» и войдите заново через Google.\n` +
        `3. Нестабильное сетевое соединение.`,
      { cause: netErr }
    );
  }

  if (!contentRes.ok) {
    const errorBody = await contentRes.text();
    let parsedMsg = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      parsedMsg = parsed.error?.message || errorBody;
    } catch {
      // use raw
    }

    if (contentRes.status === 403) {
      const lower = parsedMsg.toLowerCase();
      if (
        lower.includes('insufficient authentication scopes') ||
        lower.includes('access_token_scope_insufficient')
      ) {
        throw new Error(
          `Недостаточно разрешений токена (Insufficient Scopes). Пожалуйста, выполните повторный вход через Google (нажмите "Выйти" и "Войти через Google" вверху), чтобы предоставить доступ к Apps Script API.`
        );
      }

      if (
        lower.includes('has not been used in project') ||
        lower.includes('is disabled') ||
        lower.includes('enable it by visiting')
      ) {
        const match = parsedMsg.match(/project[=\s]([0-9a-zA-Z\-_]+)/i);
        const proj = match ? match[1] : '385972489711';
        throw new Error(
          `GCP_API_DISABLED: В облачном проекте Google Cloud не активирован сервис Apps Script API.\n\n` +
            `Пожалуйста, перейдите по ссылке и нажмите синюю кнопку "ВКЛЮЧИТЬ" (ENABLE):\n` +
            `https://console.developers.google.com/apis/api/script.googleapis.com/overview?project=${proj}\n\n` +
            `(После активации изменения вступают в силу в течение 1–2 минут).`
        );
      }

      throw new Error(
        `Apps Script API вернул 403 (Permission Denied). Убедитесь, что Google Apps Script API включен в настройках вашего Google-аккаунта: https://script.google.com/home/usersettings (переключатель "Google Apps Script API: ON"). Подробности: ${parsedMsg}`
      );
    }

    if (contentRes.status === 400) {
      if (parsedMsg.toLowerCase().includes('invalid script key')) {
        throw new Error(
          `INVALID_SCRIPT_KEY: Указан неверный ключ скрипта (Invalid script key).\n\n` +
            `Вы вставили идентификатор таблицы Google Sheets вместо идентификатора скрипта Apps Script.\n` +
            `У таблицы и встроенного в нее скрипта разные ID.\n\n` +
            `Как получить правильный Script ID:\n` +
            `1. Откройте таблицу в Google и выберите в меню: «Расширения» → «Apps Script».\n` +
            `2. В открывшемся редакторе скриптов скопируйте URL из адресной строки браузера (https://script.google.com/home/projects/.../edit) или нажмите на значок шестеренки слева (⚙️ Настройки проекта) и скопируйте «Идентификатор скрипта».\n` +
            `3. Вставьте скопированный URL или Script ID.`
        );
      }
    }

    throw new Error(`Failed to fetch Apps Script content (${contentRes.status}): ${parsedMsg}`);
  }

  const content = await contentRes.json();
  const files: ScriptFile[] = (content.files || []).map((f: any) => ({
    name: f.name,
    type: f.type || 'SERVER_JS',
    source: f.source || ''
  }));

  return {
    scriptId: cleanScriptId,
    title,
    parentId,
    files,
    lastModified: new Date().toISOString()
  };
};

export const updateAppsScriptProject = async (
  scriptId: string,
  files: ScriptFile[],
  accessToken: string
): Promise<void> => {
  const cleanScriptId = extractScriptId(scriptId);

  const res = await apiFetch(`${SCRIPT_API_BASE}/projects/${cleanScriptId}/content`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: files.map((f) => ({
        name: f.name,
        type: f.type,
        source: f.source
      }))
    })
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to update Apps Script project (${res.status}): ${errorBody}`);
  }
};

export const downloadProjectAsZip = async (
  project: AppsScriptProject,
  customZipName?: string
): Promise<void> => {
  const zip = new JSZip();

  // Create folder inside zip
  const folderName = project.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'AppsScript';
  const folder = zip.folder(folderName) || zip;

  project.files.forEach((file) => {
    let extension = '.gs';
    if (file.type === 'HTML') extension = '.html';
    else if (file.type === 'JSON' || file.name === 'appsscript') extension = '.json';
    else if (file.type === 'SERVER_JS') extension = '.js';

    // If file already has matching extension in name, don't double append
    const fileName = file.name.endsWith(extension) ? file.name : `${file.name}${extension}`;
    folder.file(fileName, file.source);
  });

  // Also include project metadata summary
  folder.file(
    'project-metadata.json',
    JSON.stringify(
      {
        scriptId: project.scriptId,
        title: project.title,
        parentId: project.parentId,
        downloadedAt: new Date().toISOString(),
        filesCount: project.files.length
      },
      null,
      2
    )
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = customZipName || `${folderName}_backup_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadSingleFile = (file: ScriptFile, projectTitle: string) => {
  let ext = '.gs';
  if (file.type === 'HTML') ext = '.html';
  else if (file.type === 'JSON' || file.name === 'appsscript') ext = '.json';

  const fileName = file.name.endsWith(ext) ? file.name : `${file.name}${ext}`;
  const blob = new Blob([file.source], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectTitle.replace(/\s+/g, '_')}_${fileName}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export interface FunctionRunResult {
  status: 'success' | 'error';
  result?: any;
  logs: string[];
  durationMs: number;
  error?: string;
  source: 'cloud' | 'local_runner';
}

export interface ScriptFunctionInfo {
  name: string;
  fileName: string;
  lineNumber?: number;
}

export const extractFunctionsFromCode = (
  source: string,
  fileName: string = ''
): ScriptFunctionInfo[] => {
  if (!source) return [];
  const results: ScriptFunctionInfo[] = [];
  const seen = new Set<string>();
  const ignoreKeywords = new Set([
    'if',
    'for',
    'while',
    'switch',
    'catch',
    'with',
    'function',
    'return',
    'import',
    'export',
    'class',
    'new',
    'typeof',
    'instanceof'
  ]);

  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

    // 1. function name(...) or async function name(...) or export function name(...)
    const funcMatch = line.match(
      /(?:export\s+)?(?:async\s+)?function(?:\s*\*|\s+)+([a-zA-Z0-9_$]+)\s*\(/
    );
    if (funcMatch && funcMatch[1]) {
      const name = funcMatch[1];
      if (!seen.has(name) && !ignoreKeywords.has(name)) {
        seen.add(name);
        results.push({ name, fileName, lineNumber: i + 1 });
      }
    }

    // 2. const/let/var name = ... (arrow functions or function expressions)
    const varFuncMatch = line.match(
      /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>)/
    );
    if (varFuncMatch && varFuncMatch[1]) {
      const name = varFuncMatch[1];
      if (!seen.has(name) && !ignoreKeywords.has(name)) {
        seen.add(name);
        results.push({ name, fileName, lineNumber: i + 1 });
      }
    }

    // 3. name: function(...) or name: (...) => ... (object methods)
    const objFuncMatch = line.match(
      /^\s*([a-zA-Z0-9_$]+)\s*:\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)/
    );
    if (objFuncMatch && objFuncMatch[1]) {
      const name = objFuncMatch[1];
      if (!seen.has(name) && !ignoreKeywords.has(name)) {
        seen.add(name);
        results.push({ name, fileName, lineNumber: i + 1 });
      }
    }

    // 4. this.name = ... or globalThis.name = ...
    const globalMatch = line.match(
      /(?:this|globalThis|window)\.([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)/
    );
    if (globalMatch && globalMatch[1]) {
      const name = globalMatch[1];
      if (!seen.has(name) && !ignoreKeywords.has(name)) {
        seen.add(name);
        results.push({ name, fileName, lineNumber: i + 1 });
      }
    }
  }

  // Fallback global regex scan to ensure multi-line declarations are also caught
  const globalRegex =
    /(?:function\s+([a-zA-Z0-9_$]+)\s*\(|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>))/g;
  let match;
  while ((match = globalRegex.exec(source)) !== null) {
    const fnName = match[1] || match[2];
    if (fnName && !seen.has(fnName) && !ignoreKeywords.has(fnName)) {
      seen.add(fnName);
      results.push({ name: fnName, fileName });
    }
  }

  return results;
};

export const extractAllScriptFunctions = (files: ScriptFile[]): ScriptFunctionInfo[] => {
  const all: ScriptFunctionInfo[] = [];
  const seen = new Set<string>();

  files.forEach((file) => {
    const funcs = extractFunctionsFromCode(file.source || '', file.name);
    funcs.forEach((fn) => {
      const key = `${fn.fileName}:${fn.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(fn);
      }
    });
  });

  return all;
};

export const extractScriptFunctionNames = (files: ScriptFile[]): string[] => {
  const funcs = extractAllScriptFunctions(files);
  return Array.from(new Set(funcs.map((f) => f.name)));
};

export const runAppsScriptFunction = async (
  scriptId: string,
  functionName: string,
  parameters: any[] = [],
  accessToken: string | null,
  files?: ScriptFile[]
): Promise<FunctionRunResult> => {
  const startTime = Date.now();
  const capturedLogs: string[] = [];

  // 1. Try Google Apps Script API (scripts.run) if accessToken is provided
  if (accessToken && scriptId && scriptId.length > 10) {
    try {
      const res = await apiFetch(`${SCRIPT_API_BASE}/scripts/${extractScriptId(scriptId)}:run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          function: functionName,
          parameters,
          devMode: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        const duration = Date.now() - startTime;
        if (data.error) {
          const detail = data.error.details?.[0];
          return {
            status: 'error',
            logs:
              detail?.scriptStackTraceElements?.map(
                (s: any) => `at ${s.function} (${s.lineNumber})`
              ) || [],
            durationMs: duration,
            error: data.error.message || detail?.errorMessage || 'Script execution error',
            source: 'cloud'
          };
        }
        return {
          status: 'success',
          result: data.response?.result,
          logs: [`[Google Cloud API] Функция ${functionName} выполнена успешно`],
          durationMs: duration,
          source: 'cloud'
        };
      }
    } catch {
      // Fall through to in-browser runner emulator
    }
  }

  // 2. Intelligent in-browser Apps Script Simulator / Local Runner
  try {
    const jsFiles = (files || []).filter(
      (f) => f.type === 'SERVER_JS' || !f.type || f.name.endsWith('.gs') || f.name.endsWith('.js')
    );
    const combinedCode = jsFiles.map((f) => f.source || '').join('\n\n');

    const mockLogger = {
      log: (...args: any[]) => {
        const text = args
          .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');
        capturedLogs.push(`[Logger.log] ${text}`);
      }
    };

    const mockSpreadsheetApp = {
      getActiveSpreadsheet: () => mockSpreadsheetApp,
      getActiveSheet: () => mockSpreadsheetApp,
      getName: () => 'Лист1',
      getDataRange: () => mockSpreadsheetApp,
      getValues: () => [
        ['A', 'B', 'C'],
        [1, 'Тест', 100],
        [2, 'Данные', 200]
      ],
      appendRow: (row: any[]) => {
        capturedLogs.push(`[SpreadsheetApp.appendRow] ${JSON.stringify(row)}`);
      },
      getRange: () => ({
        setValue: (val: any) => capturedLogs.push(`[Range.setValue] ${val}`),
        setValues: (vals: any) => capturedLogs.push(`[Range.setValues] ${JSON.stringify(vals)}`),
        getValue: () => 'Значение',
        getValues: () => [['Значение']]
      }),
      getUi: () => ({
        alert: (msg: string) => capturedLogs.push(`[UI.alert] ${msg}`),
        createMenu: (name: string) => ({
          addItem: () => ({ addSeparator: () => ({ addToUi: () => {} }), addToUi: () => {} }),
          addSeparator: () => ({ addItem: () => ({ addToUi: () => {} }), addToUi: () => {} }),
          addToUi: () => capturedLogs.push(`[UI.createMenu] Меню: "${name}"`)
        })
      })
    };

    const mockUtilities = {
      formatDate: (date: Date) => date.toLocaleString(),
      sleep: () => {},
      base64Encode: (str: string) => btoa(str),
      base64Decode: (str: string) => atob(str)
    };

    const mockSession = {
      getActiveUser: () => ({ getEmail: () => 'user@gmail.com' }),
      getEffectiveUser: () => ({ getEmail: () => 'user@gmail.com' })
    };

    const mockMailApp = {
      sendEmail: (opts: any) => {
        capturedLogs.push(`[MailApp.sendEmail] Кому: ${opts.to}, Тема: ${opts.subject}`);
      }
    };

    const mockUrlFetchApp = {
      fetch: () => ({
        getResponseCode: () => 200,
        getContentText: () => '{"status":"ok"}'
      })
    };

    const runner = new Function(
      'Logger',
      'SpreadsheetApp',
      'Utilities',
      'Session',
      'MailApp',
      'UrlFetchApp',
      `
        ${combinedCode}
        if (typeof ${functionName} !== 'function') {
          throw new Error('Функция "' + '${functionName}' + '" не найдена в коде проекта.');
        }
        return ${functionName}();
      `
    );

    const res = runner(
      mockLogger,
      mockSpreadsheetApp,
      mockUtilities,
      mockSession,
      mockMailApp,
      mockUrlFetchApp
    );

    const duration = Date.now() - startTime;
    return {
      status: 'success',
      result: res !== undefined ? res : 'undefined (выполнено без return)',
      logs:
        capturedLogs.length > 0
          ? capturedLogs
          : [`Функция ${functionName}() выполнена без вызовов Logger.log`],
      durationMs: duration,
      source: 'local_runner'
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    return {
      status: 'error',
      logs: capturedLogs,
      durationMs: duration,
      error: err.message || String(err),
      source: 'local_runner'
    };
  }
};
