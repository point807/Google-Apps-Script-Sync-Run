import { apiFetch } from './http';
import LocalRunnerWorker from './localRunnerWorker?worker';
import { AppsScriptProject, ScriptFile } from '../types';
import { JAVASCRIPT_IDENTIFIER_PATTERN } from './javascriptIdentifier';
import { downloadBlob, downloadText, safeFileName } from './download';
import { fileNameWithExtension } from './scriptFileNaming';
import { projectToZipBlob } from './projectTransfer';

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
  const folderName = safeFileName(project.title, 'AppsScript');
  const blob = await projectToZipBlob(project);
  downloadBlob(blob, safeFileName(customZipName || `${folderName}_backup_${Date.now()}`, 'project'));
};

export const downloadSingleFile = (file: ScriptFile, projectTitle: string): void => {
  downloadText(
    file.source,
    `${safeFileName(projectTitle, 'AppsScript')}_${fileNameWithExtension(file)}`
  );
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

/**
 * Compiled once (module scope): building these per line — as the previous
 * implementation did — cost thousands of RegExp compilations per keystroke.
 */
const FUNCTION_DECLARATION_RE = new RegExp(
  String.raw`(?:export\s+)?(?:async\s+)?function(?:\s*\*|\s+)+(${JAVASCRIPT_IDENTIFIER_PATTERN})\s*\(`,
  'u'
);
const ASSIGNED_FUNCTION_RE = new RegExp(
  String.raw`(?:const|let|var)\s+(${JAVASCRIPT_IDENTIFIER_PATTERN})\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|${JAVASCRIPT_IDENTIFIER_PATTERN}\s*=>)`,
  'u'
);
const OBJECT_METHOD_RE = new RegExp(
  String.raw`^\s*(${JAVASCRIPT_IDENTIFIER_PATTERN})\s*:\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)`,
  'u'
);
const GLOBAL_ASSIGNMENT_RE = new RegExp(
  String.raw`(?:this|globalThis|window)\.(${JAVASCRIPT_IDENTIFIER_PATTERN})\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)`,
  'u'
);
const FALLBACK_SCAN_RE = new RegExp(
  String.raw`(?:function(?:\s*\*|\s+)+(${JAVASCRIPT_IDENTIFIER_PATTERN})\s*\(|(?:const|let|var)\s+(${JAVASCRIPT_IDENTIFIER_PATTERN})\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|${JAVASCRIPT_IDENTIFIER_PATTERN}\s*=>))`,
  'gu'
);

const IGNORED_FUNCTION_KEYWORDS = new Set([
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

export const extractFunctionsFromCode = (
  source: string,
  fileName: string = ''
): ScriptFunctionInfo[] => {
  if (!source) return [];

  // Cheap bail-out: every supported form needs one of these two tokens.
  if (!source.includes('function') && !source.includes('=>')) return [];

  const results: ScriptFunctionInfo[] = [];
  const seen = new Set<string>();

  const push = (match: RegExpMatchArray | null, lineNumber: number) => {
    const name = match?.[1];
    if (!name || seen.has(name) || IGNORED_FUNCTION_KEYWORDS.has(name)) return;
    seen.add(name);
    results.push({ name, fileName, lineNumber });
  };

  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    push(line.match(FUNCTION_DECLARATION_RE), i + 1);
    push(line.match(ASSIGNED_FUNCTION_RE), i + 1);
    push(line.match(OBJECT_METHOD_RE), i + 1);
    push(line.match(GLOBAL_ASSIGNMENT_RE), i + 1);
  }

  // Fallback scan for declarations the per-line pass cannot see (multi-line
  // signatures, declarations after code on the same line). These entries have
  // no line number, exactly as before.
  FALLBACK_SCAN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FALLBACK_SCAN_RE.exec(source)) !== null) {
    const fnName = match[1] || match[2];
    if (fnName && !seen.has(fnName) && !IGNORED_FUNCTION_KEYWORDS.has(fnName)) {
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

export interface ScriptVersion {
  versionNumber: number;
  description?: string;
  createTime?: string;
}

export interface ScriptDeploymentEntryPoint {
  entryPointType?: string;
  executionApi?: { entryPointConfig?: { access?: string } };
  webApp?: { url?: string };
}

export interface ScriptDeployment {
  deploymentId: string;
  deploymentConfig?: {
    versionNumber?: number;
    description?: string;
    manifestFileName?: string;
  };
  updateTime?: string;
  entryPoints?: ScriptDeploymentEntryPoint[];
}

export const listVersions = async (
  accessToken: string,
  scriptId: string
): Promise<ScriptVersion[]> => {
  const res = await apiFetch(
    `${SCRIPT_API_BASE}/projects/${extractScriptId(scriptId)}/versions?pageSize=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Не удалось получить список версий: ${res.status} ${err}`);
  }
  const data = await res.json();
  return (data.versions || []) as ScriptVersion[];
};

export const createVersion = async (
  accessToken: string,
  scriptId: string,
  description: string
): Promise<ScriptVersion> => {
  const res = await apiFetch(`${SCRIPT_API_BASE}/projects/${extractScriptId(scriptId)}/versions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ description })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Не удалось создать версию: ${res.status} ${err}`);
  }
  return (await res.json()) as ScriptVersion;
};

export const listDeployments = async (
  accessToken: string,
  scriptId: string
): Promise<ScriptDeployment[]> => {
  const res = await apiFetch(
    `${SCRIPT_API_BASE}/projects/${extractScriptId(scriptId)}/deployments?pageSize=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Не удалось получить список деплоев: ${res.status} ${err}`);
  }
  const data = await res.json();
  return (data.deployments || []) as ScriptDeployment[];
};

export const createDeployment = async (
  accessToken: string,
  scriptId: string,
  description: string,
  versionNumber?: number
): Promise<ScriptDeployment> => {
  const body: Record<string, unknown> = {
    description,
    manifestFileName: 'appsscript'
  };
  if (versionNumber) body.versionNumber = versionNumber;
  const res = await apiFetch(
    `${SCRIPT_API_BASE}/projects/${extractScriptId(scriptId)}/deployments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Не удалось создать деплой: ${res.status} ${err}`);
  }
  return (await res.json()) as ScriptDeployment;
};

export const updateDeploymentVersion = async (
  accessToken: string,
  scriptId: string,
  deploymentId: string,
  versionNumber: number
): Promise<ScriptDeployment> => {
  const res = await apiFetch(
    `${SCRIPT_API_BASE}/projects/${extractScriptId(scriptId)}/deployments/${deploymentId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deploymentConfig: {
          versionNumber,
          manifestFileName: 'appsscript'
        },
        updateMask: 'deploymentConfig.versionNumber'
      })
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Не удалось обновить деплой: ${res.status} ${err}`);
  }
  return (await res.json()) as ScriptDeployment;
};

/** True when the deployment exposes an EXECUTION_API entry point (scripts.run). */
export const isApiExecutable = (deployment: ScriptDeployment): boolean =>
  (deployment.entryPoints || []).some((e) => e.entryPointType === 'EXECUTION_API');

interface LocalRunnerResponse {
  status: 'success' | 'error';
  result?: unknown;
  logs: string[];
  error?: string;
}

const LOCAL_RUNNER_TIMEOUT_MS = 15000;

/** Runs user code in a dedicated worker (sandbox: no DOM/window). */
const runInLocalWorker = (
  code: string,
  functionName: string,
  parameters: unknown[]
): Promise<LocalRunnerResponse> =>
  new Promise((resolve) => {
    let worker: Worker | null = null;
    const finish = (response: LocalRunnerResponse) => {
      clearTimeout(timer);
      worker?.terminate();
      resolve(response);
    };
    const timer = setTimeout(
      () =>
        finish({
          status: 'error',
          logs: [],
          error: 'Локальный запуск превысил лимит времени (15 с)'
        }),
      LOCAL_RUNNER_TIMEOUT_MS
    );
    try {
      worker = new LocalRunnerWorker();
      worker.onmessage = (e: MessageEvent<LocalRunnerResponse>) => finish(e.data);
      worker.onerror = (e) =>
        finish({
          status: 'error',
          logs: [],
          error: `Ошибка локального runner: ${e.message || 'unknown'}`
        });
      worker.postMessage({ code, functionName, parameters });
    } catch (err: any) {
      finish({ status: 'error', logs: [], error: err?.message || String(err) });
    }
  });

export const runAppsScriptFunction = async (
  scriptId: string,
  functionName: string,
  parameters: any[] = [],
  accessToken: string | null,
  files?: ScriptFile[]
): Promise<FunctionRunResult> => {
  const startTime = Date.now();

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

  // 2. Sandboxed in-browser runner (Web Worker — no DOM/window access)
  try {
    const jsFiles = (files || []).filter(
      (f) => f.type === 'SERVER_JS' || !f.type || f.name.endsWith('.gs') || f.name.endsWith('.js')
    );
    const combinedCode = jsFiles.map((f) => f.source || '').join('\n\n');

    const workerResult = await runInLocalWorker(combinedCode, functionName, parameters);
    const duration = Date.now() - startTime;

    if (workerResult.status === 'error') {
      return {
        status: 'error',
        logs: workerResult.logs,
        durationMs: duration,
        error: workerResult.error || 'Ошибка локального runner',
        source: 'local_runner'
      };
    }
    return {
      status: 'success',
      result:
        workerResult.result !== undefined
          ? workerResult.result
          : 'undefined (выполнено без return)',
      logs:
        workerResult.logs.length > 0
          ? workerResult.logs
          : [`Функция ${functionName}() выполнена без вызовов Logger.log`],
      durationMs: duration,
      source: 'local_runner'
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    return {
      status: 'error',
      logs: [],
      durationMs: duration,
      error: err.message || String(err),
      source: 'local_runner'
    };
  }
};
