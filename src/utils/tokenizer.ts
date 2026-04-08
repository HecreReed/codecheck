/**
 * Tokenizer: strips comments and tracks string literal ranges.
 * Returns cleaned source (comments replaced with whitespace) and string ranges.
 */

export interface StringRange {
  start: number; // offset in original source
  end: number;
}

export interface TokenizerResult {
  cleaned: string;       // comments replaced with spaces, strings preserved
  stringRanges: StringRange[];
}

export function tokenize(source: string): TokenizerResult {
  const chars = source.split('');
  const len = chars.length;
  const stringRanges: StringRange[] = [];
  let i = 0;

  while (i < len) {
    // Line comment
    if (chars[i] === '/' && chars[i + 1] === '/') {
      const start = i;
      while (i < len && chars[i] !== '\n') {
        chars[i] = ' ';
        i++;
      }
      continue;
    }
    // Block comment
    if (chars[i] === '/' && chars[i + 1] === '*') {
      chars[i] = ' ';
      chars[i + 1] = ' ';
      i += 2;
      while (i < len) {
        if (chars[i] === '*' && chars[i + 1] === '/') {
          chars[i] = ' ';
          chars[i + 1] = ' ';
          i += 2;
          break;
        }
        if (chars[i] !== '\n') chars[i] = ' ';
        i++;
      }
      continue;
    }
    // String literal
    if (chars[i] === '"') {
      const start = i;
      i++;
      while (i < len) {
        if (chars[i] === '\\') { i += 2; continue; }
        if (chars[i] === '"') { i++; break; }
        i++;
      }
      stringRanges.push({ start, end: i });
      continue;
    }
    // Char literal
    if (chars[i] === "'") {
      i++;
      while (i < len) {
        if (chars[i] === '\\') { i += 2; continue; }
        if (chars[i] === "'") { i++; break; }
        i++;
      }
      continue;
    }
    i++;
  }

  return { cleaned: chars.join(''), stringRanges };
}

/** Convert a character offset to { line, col } (0-based) */
export function offsetToLineCol(source: string, offset: number): { line: number; col: number } {
  let line = 0;
  let col = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') { line++; col = 0; } else { col++; }
  }
  return { line, col };
}

/** Convert { line, col } (0-based) to a character offset */
export function lineColToOffset(source: string, line: number, col: number): number {
  if (line <= 0) {
    return Math.max(0, Math.min(col, source.length));
  }

  let currentLine = 0;
  let offset = 0;
  while (offset < source.length && currentLine < line) {
    if (source[offset] === '\n') {
      currentLine++;
    }
    offset++;
  }

  return Math.min(offset + col, source.length);
}

/** Split source into lines */
export function getLines(source: string): string[] {
  return source.split('\n');
}
