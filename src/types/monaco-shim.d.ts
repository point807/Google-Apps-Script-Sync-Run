/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal type surface for 'monaco-editor'.
 *
 * The bundled monaco.d.ts (~45k lines) makes typescript 6.0.3 overflow the
 * call stack even with skipLibCheck, so tsconfig `paths` redirects the module
 * to this shim. Runtime imports are unaffected — Vite resolves the real
 * package; only `tsc` sees these declarations.
 */

export interface IDisposable {
  dispose(): void;
}

export class Range {
  constructor(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number);
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export namespace editor {
  interface IStandaloneCodeEditor {
    getAction(id: string): { run(): Promise<void> } | undefined;
    getValue(): string;
    setValue(value: string): void;
    updateOptions(options: unknown): void;
    layout(): void;
    focus(): void;
    dispose(): void;
  }

  interface IStandaloneThemeData {
    base: string;
    inherit: boolean;
    rules: Array<{ token: string; foreground: string; fontStyle?: string }>;
    colors: Record<string, string>;
  }

  function defineTheme(name: string, theme: IStandaloneThemeData): void;

  type IStandaloneCodeEditorConstructionOptions = Record<string, unknown>;
  type IEditorConstructionOptions = Record<string, unknown>;
  type IModelContentChangedEvent = unknown;
  type BuiltinTheme = string;
}

export namespace languages {
  interface CompletionItem {
    label: string;
    kind: number;
    insertText: string;
    range: unknown;
    detail?: string;
  }

  interface CompletionItemProvider {
    triggerCharacters?: readonly string[];
    provideCompletionItems(
      model: {
        getWordUntilPosition(position: unknown): {
          word: string;
          startColumn: number;
          endColumn: number;
        };
      },
      position: { lineNumber: number; column: number }
    ): { suggestions: CompletionItem[] };
  }

  const CompletionItemKind: {
    Method: number;
    Function: number;
    Module: number;
    Property: number;
    Variable: number;
    Snippet: number;
    [name: string]: number;
  };

  function registerCompletionItemProvider(
    languageSelector: string,
    provider: CompletionItemProvider
  ): IDisposable;

  namespace typescript {
    interface LanguageServiceDefaults {
      setDiagnosticsOptions(options: {
        noSemanticValidation: boolean;
        noSyntaxValidation: boolean;
      }): void;
      addExtraLib(code: string, uri?: string): IDisposable;
    }
    const javascriptDefaults: LanguageServiceDefaults;
    const typescriptDefaults: LanguageServiceDefaults;
  }
}
