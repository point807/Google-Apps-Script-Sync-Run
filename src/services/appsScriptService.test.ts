/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import {
  extractFunctionsFromCode,
  extractScriptId,
  extractSpreadsheetId,
} from './appsScriptService';

describe('extractScriptId', () => {
  it('extracts id from the editor URL', () => {
    expect(extractScriptId('https://script.google.com/home/projects/1AbCdEfGhIjKlMnOp/edit')).toBe(
      '1AbCdEfGhIjKlMnOp'
    );
  });

  it('extracts id from multi-account editor URL', () => {
    expect(
      extractScriptId('https://script.google.com/u/0/home/projects/1AbCdEfGhIjKlMnOp/edit')
    ).toBe('1AbCdEfGhIjKlMnOp');
  });

  it('extracts id from /macros/d/ and /d/ URLs', () => {
    expect(extractScriptId('https://script.google.com/macros/d/1AbCdEfGhIjKlMnOp/edit')).toBe(
      '1AbCdEfGhIjKlMnOp'
    );
    expect(extractScriptId('https://script.google.com/d/1AbCdEfGhIjKlMnOp/edit')).toBe(
      '1AbCdEfGhIjKlMnOp'
    );
  });

  it('extracts id from a Drive file link', () => {
    expect(extractScriptId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view')).toBe(
      '1AbCdEfGhIjKlMnOp'
    );
  });

  it('accepts a bare script id', () => {
    const id = '1abcdefghijklmnopqrstuvwxyz0123456789';
    expect(extractScriptId(id)).toBe(id);
  });

  it('finds a long id inside arbitrary text', () => {
    const id = '1abcdefghijklmnopqrstuvwxyz0123456789';
    expect(extractScriptId(`project=${id} extra`)).toBe(id);
  });

  it('returns trimmed input when nothing matches', () => {
    expect(extractScriptId('  short-name  ')).toBe('short-name');
  });

  it('handles empty input', () => {
    expect(extractScriptId('')).toBe('');
  });
});

describe('extractSpreadsheetId', () => {
  it('extracts id from a spreadsheet URL', () => {
    expect(
      extractSpreadsheetId('https://docs.google.com/spreadsheets/d/1SheetIdAbcDefGhIjKlMnOp/edit')
    ).toBe('1SheetIdAbcDefGhIjKlMnOp');
  });

  it('extracts id from a multi-account spreadsheet URL', () => {
    expect(
      extractSpreadsheetId(
        'https://docs.google.com/spreadsheets/u/1/d/1SheetIdAbcDefGhIjKlMnOp/edit'
      )
    ).toBe('1SheetIdAbcDefGhIjKlMnOp');
  });

  it('returns null for non-spreadsheet input', () => {
    expect(extractSpreadsheetId('https://example.com')).toBeNull();
    expect(extractSpreadsheetId('short')).toBeNull();
  });
});

describe('extractFunctionsFromCode', () => {
  it('finds function declarations', () => {
    const funcs = extractFunctionsFromCode('function myFunction() {}\nfunction other() {}', 'Code');
    expect(funcs.map((f) => f.name)).toEqual(['myFunction', 'other']);
    expect(funcs[0].fileName).toBe('Code');
  });

  it('finds arrow functions and function expressions', () => {
    const source = [
      'const doWork = () => {};',
      'const handle = function (e) {};',
      'let runIt = async () => {};',
    ].join('\n');
    const names = extractFunctionsFromCode(source).map((f) => f.name);
    expect(names).toEqual(['doWork', 'handle', 'runIt']);
  });

  it('ignores control-flow keywords', () => {
    const names = extractFunctionsFromCode('if (x) {}\nfor (y) {}\nwhile (z) {}').map((f) => f.name);
    expect(names).toEqual([]);
  });

  it('deduplicates repeated function names', () => {
    const names = extractFunctionsFromCode('function a() {}\nfunction a() {}').map((f) => f.name);
    expect(names).toEqual(['a']);
  });

  it('returns empty list for empty source', () => {
    expect(extractFunctionsFromCode('')).toEqual([]);
  });
});
