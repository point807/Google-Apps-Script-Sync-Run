/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { isJavaScriptIdentifier } from './javascriptIdentifier';

describe('isJavaScriptIdentifier', () => {
  it('accepts plain Latin identifiers', () => {
    expect(isJavaScriptIdentifier('myFunction')).toBe(true);
    expect(isJavaScriptIdentifier('_private$1')).toBe(true);
  });

  it('accepts Cyrillic identifiers', () => {
    expect(isJavaScriptIdentifier('отправитьОтчёт')).toBe(true);
    expect(isJavaScriptIdentifier('Сумма')).toBe(true);
    expect(isJavaScriptIdentifier('_час2')).toBe(true);
  });

  it('rejects invalid names', () => {
    expect(isJavaScriptIdentifier('')).toBe(false);
    expect(isJavaScriptIdentifier('2имя')).toBe(false);
    expect(isJavaScriptIdentifier('имя функции')).toBe(false);
    expect(isJavaScriptIdentifier('foo()')).toBe(false);
    expect(isJavaScriptIdentifier("a'b")).toBe(false);
  });
});
