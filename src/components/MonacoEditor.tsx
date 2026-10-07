/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { ScriptFile } from '../types';
import { APPS_SCRIPT_API_LIB, APPS_SCRIPT_SERVICES } from '../services/appsScriptApiDefs';

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker(workerId: string, label: string): Worker;
    };
  }
}

// Bundle monaco locally (no CDN) and wire its web workers for Vite.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};
loader.config({ monaco });

// ---- Apps Script intelligence (one-time setup) ----
let apiIntelligenceInstalled = false;

const installAppsScriptIntelligence = () => {
  if (apiIntelligenceInstalled) return;
  apiIntelligenceInstalled = true;

  // monaco 0.5x marks the typed `typescript` contribution as deprecated in
  // the full-bundle types, while the runtime API is stable.
  const tsLang = monaco.languages.typescript as unknown as {
    javascriptDefaults: {
      setDiagnosticsOptions: (options: {
        noSemanticValidation: boolean;
        noSyntaxValidation: boolean;
      }) => void;
      addExtraLib: (code: string, uri?: string) => void;
    };
  };
  const jsDefaults = tsLang.javascriptDefaults;
  jsDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
  jsDefaults.addExtraLib(APPS_SCRIPT_API_LIB, 'ts:apps-script-api.d.ts');

  monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn
      );
      return {
        suggestions: APPS_SCRIPT_SERVICES.map((name) => ({
          label: name,
          kind: monaco.languages.CompletionItemKind.Module,
          insertText: name,
          range,
          detail: 'Google Apps Script service'
        }))
      };
    }
  });

  monaco.editor.defineTheme('scriptvault-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748b' },
      { token: 'keyword', foreground: 'c084fc' },
      { token: 'string', foreground: '6ee7b7' },
      { token: 'number', foreground: 'fbbf24' }
    ],
    colors: {
      'editor.background': '#0f172a',
      'editor.lineHighlightBackground': '#1e293b80',
      'editorLineNumber.foreground': '#475569',
      'editorCursor.foreground': '#818cf8',
      'editor.selectionBackground': '#6366f140'
    }
  });
};

const languageForFile = (file: ScriptFile): string => {
  if (file.type === 'JSON' || file.name === 'appsscript') return 'json';
  if (file.type === 'HTML') return 'html';
  return 'javascript';
};

export interface MonacoEditorProps {
  file: ScriptFile;
  onChange: (content: string) => void;
  fontSize: number;
  wordWrap: boolean;
  /** Bumped by the toolbar to open the find widget. */
  findSignal: number;
  onEditorMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

/** Thin monaco-editor wrapper: local bundle, Apps Script completions, dark theme. */
export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  file,
  onChange,
  fontSize,
  wordWrap,
  findSignal,
  onEditorMount
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const findSignalRef = useRef(findSignal);

  const handleMount: OnMount = (editor) => {
    installAppsScriptIntelligence();
    editorRef.current = editor;
    onEditorMount?.(editor);
  };

  // Open find widget when the toolbar search button is pressed.
  useEffect(() => {
    if (findSignalRef.current !== findSignal) {
      findSignalRef.current = findSignal;
      if (findSignal > 0 && editorRef.current) {
        void editorRef.current.getAction('actions.find')?.run();
      }
    }
  }, [findSignal]);

  return (
    <Editor
      height="100%"
      language={languageForFile(file)}
      value={file.source}
      theme="scriptvault-dark"
      onMount={handleMount}
      onChange={(value) => onChange(value ?? '')}
      path={file.name}
      options={{
        fontSize,
        wordWrap: wordWrap ? 'on' : 'off',
        minimap: { enabled: true },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabSize: 2,
        renderWhitespace: 'selection',
        smoothScrolling: true,
        padding: { top: 12, bottom: 12 }
      }}
    />
  );
};

export default MonacoEditor;
