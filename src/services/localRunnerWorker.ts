/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sandboxed local Apps Script runner.
 *
 * Executes user code inside a dedicated Web Worker: no DOM, no window, no
 * cookies — only the mocked Apps Script services below. The parent gets
 * logs/result/error via postMessage. This is an EMULATION with limits (see the
 * warning in ExecutionConsole), not a real Apps Script runtime.
 */
import { isJavaScriptIdentifier } from './javascriptIdentifier';

interface RunnerRequest {
  code: string;
  functionName: string;
  parameters: unknown[];
}

interface RunnerResponse {
  status: 'success' | 'error';
  result?: unknown;
  logs: string[];
  error?: string;
}

const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent<RunnerRequest>) => void) | null;
  postMessage(data: RunnerResponse): void;
};

ctx.onmessage = async (e: MessageEvent<RunnerRequest>) => {
  const { code, functionName, parameters } = e.data;
  const capturedLogs: string[] = [];

  try {
    if (!isJavaScriptIdentifier(functionName)) {
      throw new Error('Некорректное имя функции.');
    }

    const mockLogger = {
      log: (...args: unknown[]) => {
        const text = args
          .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');
        capturedLogs.push(`[Logger.log] ${text}`);
      }
    };

    const mockSpreadsheetApp = {
      getActiveSpreadsheet: (): unknown => mockSpreadsheetApp,
      getActiveSheet: (): unknown => mockSpreadsheetApp,
      getName: () => 'Лист1',
      getDataRange: (): unknown => mockSpreadsheetApp,
      getValues: () => [
        ['A', 'B', 'C'],
        [1, 'Тест', 100],
        [2, 'Данные', 200]
      ],
      appendRow: (row: unknown[]) => {
        capturedLogs.push(`[SpreadsheetApp.appendRow] ${JSON.stringify(row)}`);
      },
      getRange: () => ({
        setValue: (val: unknown) => capturedLogs.push(`[Range.setValue] ${val}`),
        setValues: (vals: unknown) =>
          capturedLogs.push(`[Range.setValues] ${JSON.stringify(vals)}`),
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
      sendEmail: (opts: { to?: string; subject?: string }) => {
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
      'params',
      `
        ${code}
        if (typeof ${functionName} !== 'function') {
          throw new Error('Функция не найдена в коде проекта.');
        }
        return ${functionName}(...params);
      `
    );

    const res = runner(
      mockLogger,
      mockSpreadsheetApp,
      mockUtilities,
      mockSession,
      mockMailApp,
      mockUrlFetchApp,
      parameters
    );
    const value = await Promise.resolve(res);

    ctx.postMessage({
      status: 'success',
      result: value !== undefined ? value : undefined,
      logs: capturedLogs
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ status: 'error', logs: capturedLogs, error: message });
  }
};
