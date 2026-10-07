/**
 * ECMAScript identifiers may contain Unicode letters, including Cyrillic.
 * `$`, `_`, ZWNJ, and ZWJ are included explicitly per the identifier grammar.
 */
export const JAVASCRIPT_IDENTIFIER_PATTERN = String.raw`[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*`;

const JAVASCRIPT_IDENTIFIER = new RegExp(`^${JAVASCRIPT_IDENTIFIER_PATTERN}$`, 'u');

export const isJavaScriptIdentifier = (value: string): boolean => JAVASCRIPT_IDENTIFIER.test(value);
