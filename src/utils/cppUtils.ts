export interface FunctionCallMatch {
  name: string;
  args: string[];
}

export interface FormatSpecifier {
  raw: string;
  kind: 'integer' | 'float' | 'string' | 'char' | 'pointer' | 'unknown';
}

export function extractFunctionCall(line: string, functionNames: string[]): FunctionCallMatch | undefined {
  const escapedNames = functionNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escapedNames.join('|')})\\s*\\(`);
  const match = line.match(pattern);
  if (!match || match.index === undefined) {
    return undefined;
  }

  const start = match.index + match[0].length;
  let depth = 1;
  let cursor = start;
  while (cursor < line.length && depth > 0) {
    const ch = line[cursor];
    if (ch === '"' || ch === '\'') {
      cursor = skipQuotedSegment(line, cursor);
      continue;
    }
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    }
    cursor++;
  }

  if (depth !== 0) {
    return undefined;
  }

  const argText = line.slice(start, cursor - 1);
  return {
    name: match[1],
    args: splitArguments(argText),
  };
}

export function splitArguments(argText: string): string[] {
  const args: string[] = [];
  let current = '';
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;

  for (let i = 0; i < argText.length; i++) {
    const ch = argText[i];
    if (ch === '"' || ch === '\'') {
      const next = skipQuotedSegment(argText, i);
      current += argText.slice(i, next);
      i = next - 1;
      continue;
    }

    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen--;
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket--;
    else if (ch === '{') depthBrace++;
    else if (ch === '}') depthBrace--;

    if (ch === ',' && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim().length > 0) {
    args.push(current.trim());
  }

  return args;
}

export function parseStringLiteral(expr: string): string | undefined {
  const trimmed = expr.trim();
  const match = trimmed.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (!match) {
    return undefined;
  }
  return match[1]
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

export function parseFormatSpecifiers(format: string): FormatSpecifier[] {
  const specifiers: FormatSpecifier[] = [];
  const pattern = /%([0-9#+\-. *hljztL]*)([diuoxXfFeEgGaAcspn%])/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(format)) !== null) {
    const conversion = match[2];
    if (conversion === '%') {
      continue;
    }
    specifiers.push({
      raw: match[0],
      kind: toSpecifierKind(conversion),
    });
  }
  return specifiers;
}

export function inferArgumentKind(expr: string): FormatSpecifier['kind'] {
  const trimmed = expr.trim();
  if (/^nullptr$/.test(trimmed) || /^NULL$/.test(trimmed) || /&\s*\w+/.test(trimmed)) {
    return 'pointer';
  }
  if (parseStringLiteral(trimmed) !== undefined || /\.c_str\s*\(\s*\)\s*$/.test(trimmed)) {
    return 'string';
  }
  if (/^'.*'$/.test(trimmed)) {
    return 'char';
  }
  if (/^[+-]?\d+$/.test(trimmed) || /^[A-Z0-9_]+\s*[\+\-*\/]\s*[A-Z0-9_]+$/i.test(trimmed)) {
    return 'integer';
  }
  if (/^[+-]?(?:\d+\.\d*|\d*\.\d+)(?:[eE][+-]?\d+)?[fFlL]?$/.test(trimmed)) {
    return 'float';
  }
  if (/\b(float|double)\b/.test(trimmed)) {
    return 'float';
  }
  if (/\b(char\s*\*|const\s+char\s*\*)\b/.test(trimmed)) {
    return 'string';
  }
  if (/\b(int|long|short|size_t|ssize_t|uint\d*_t|int\d*_t)\b/.test(trimmed)) {
    return 'integer';
  }
  if (/\bstd::string\b/.test(trimmed)) {
    return 'string';
  }
  return 'unknown';
}

function skipQuotedSegment(text: string, start: number): number {
  const quote = text[start];
  let cursor = start + 1;
  while (cursor < text.length) {
    if (text[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (text[cursor] === quote) {
      return cursor + 1;
    }
    cursor++;
  }
  return cursor;
}

function toSpecifierKind(conversion: string): FormatSpecifier['kind'] {
  if ('diuoxX'.includes(conversion)) {
    return 'integer';
  }
  if ('fFeEgGaA'.includes(conversion)) {
    return 'float';
  }
  if (conversion === 's') {
    return 'string';
  }
  if (conversion === 'c') {
    return 'char';
  }
  if (conversion === 'p' || conversion === 'n') {
    return 'pointer';
  }
  return 'unknown';
}
