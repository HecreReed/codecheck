import { Rule, RuleMatch } from '../types';
import { getLines, tokenize } from '../../utils/tokenizer';
import * as vscode from 'vscode';

interface FunctionRange {
  startLine: number;
  endLine: number;
}

interface BlockFrame {
  kind: 'function' | 'other';
  startLine: number;
}

const COMPLEXITY_RE = /\b(if|else\s+if|for|while|case|catch)\b|&&|\|\||\?(?!\?)/g;
const FUNCTION_HEADER_TRAILER_RE =
  /([~A-Za-z_][\w:<>~]*|operator\s*[^\s(]+)\s*\([^;{}]*\)\s*(?:const\b\s*)?(?:noexcept(?:\([^)]*\))?\s*)?(?:override\b\s*)?(?:final\b\s*)?(?:requires\b[^{}]*)?(?:->\s*[^{}]+)?(?:\s*:\s*[^{}]+)?$/;
const NON_FUNCTION_HEADER_RE =
  /^(?:if|for|while|switch|catch|else|do|try|namespace|class|struct|union|enum|typedef|using)\b/;

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('cppChecker');
  return {
    maxHeaderLines: cfg.get<number>('maxHeaderLines', 1000),
    maxSourceLines: cfg.get<number>('maxSourceLines', 2000),
    maxFunctionLines: cfg.get<number>('maxFunctionLines', 50),
    maxNestingDepth: cfg.get<number>('maxNestingDepth', 5),
    maxCyclomaticComplexity: cfg.get<number>('maxCyclomaticComplexity', 20),
  };
}

function normalizeHeader(header: string): string {
  return header.replace(/\s+/g, ' ').trim();
}

function looksLikeFunctionHeader(header: string): boolean {
  const normalized = normalizeHeader(header);
  if (!normalized.includes('(') || !normalized.includes(')')) {
    return false;
  }
  if (NON_FUNCTION_HEADER_RE.test(normalized)) {
    return false;
  }
  if (/\bstatic_assert\s*\(/.test(normalized)) {
    return false;
  }

  const firstParen = normalized.indexOf('(');
  const prefix = firstParen >= 0 ? normalized.slice(0, firstParen) : normalized;
  if (prefix.includes('[') && prefix.includes(']')) {
    return false;
  }

  return FUNCTION_HEADER_TRAILER_RE.test(normalized);
}

function extractFunctionHeader(lines: string[], lineIndex: number, braceCol: number): { startLine: number; header: string } | null {
  const parts: string[] = [];
  let startLine = lineIndex;
  let collectedContent = false;

  for (let i = lineIndex; i >= Math.max(0, lineIndex - 12); i--) {
    let segment = i === lineIndex ? lines[i].slice(0, braceCol) : lines[i];

    if (!collectedContent && segment.trim().length === 0) {
      continue;
    }

    collectedContent = collectedContent || segment.trim().length > 0;

    const lastDelimiter = Math.max(segment.lastIndexOf(';'), segment.lastIndexOf('{'), segment.lastIndexOf('}'));
    if (lastDelimiter >= 0) {
      segment = segment.slice(lastDelimiter + 1);
      if (segment.trim().length > 0) {
        parts.unshift(segment);
        startLine = i;
      }
      break;
    }

    if (i !== lineIndex && lines[i].trim().length === 0) {
      break;
    }

    if (segment.trim().length > 0) {
      parts.unshift(segment);
      startLine = i;
    }
  }

  const header = parts.join(' ');
  if (!looksLikeFunctionHeader(header)) {
    return null;
  }

  return { startLine, header };
}

function collectFunctionRanges(cleanedSource: string): FunctionRange[] {
  const lines = getLines(cleanedSource);
  const stack: BlockFrame[] = [];
  const functions: FunctionRange[] = [];

  lines.forEach((line, lineIndex) => {
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '{') {
        const functionHeader = extractFunctionHeader(lines, lineIndex, col);
        if (functionHeader) {
          stack.push({ kind: 'function', startLine: functionHeader.startLine });
        } else {
          stack.push({ kind: 'other', startLine: lineIndex });
        }
      } else if (ch === '}') {
        const frame = stack.pop();
        if (frame?.kind === 'function') {
          functions.push({ startLine: frame.startLine, endLine: lineIndex });
        }
      }
    }
  });

  return functions;
}

function countMeaningfulLines(lines: string[], startLine: number, endLine: number): number {
  let count = 0;
  for (let i = startLine; i <= endLine; i++) {
    if (lines[i]?.trim().length > 0) {
      count++;
    }
  }
  return count;
}

function calculateMaxBraceDepth(lines: string[], startLine: number, endLine: number): number {
  let depth = 0;
  let maxDepth = 0;

  for (let i = startLine; i <= endLine; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1);
      }
    }
  }

  return maxDepth;
}

function calculateComplexity(lines: string[], startLine: number, endLine: number): number {
  const text = lines.slice(startLine, endLine + 1).join('\n');
  return 1 + (text.match(COMPLEXITY_RE)?.length ?? 0);
}

function analyzeFunctionMetrics(source: string): RuleMatch[] {
  const cfg = getConfig();
  const cleanedSource = tokenize(source).cleaned;
  const lines = getLines(cleanedSource);
  const results: RuleMatch[] = [];

  for (const fn of collectFunctionRanges(cleanedSource)) {
    const funcLines = countMeaningfulLines(lines, fn.startLine, fn.endLine);
    const maxDepthInFunc = calculateMaxBraceDepth(lines, fn.startLine, fn.endLine);
    const complexity = calculateComplexity(lines, fn.startLine, fn.endLine);

    if (funcLines > cfg.maxFunctionLines) {
      results.push({
        ruleId: 'a3a2d2f96d6511edab16fa163e0fa374',
        line: fn.startLine,
        col: 0,
        message: `超大函数: 函数长度 ${funcLines} 行超过限制 ${cfg.maxFunctionLines} 行`
      });
    }
    if (maxDepthInFunc > cfg.maxNestingDepth) {
      results.push({
        ruleId: 'a2a6917f6d6511edab16fa163e0fa374',
        line: fn.startLine,
        col: 0,
        message: `超大深度函数: 函数最大嵌套深度 ${maxDepthInFunc} 超过限制 ${cfg.maxNestingDepth}`
      });
    }
    if (complexity > cfg.maxCyclomaticComplexity) {
      results.push({
        ruleId: 'a1fed4856d6511edab16fa163e0fa374',
        line: fn.startLine,
        col: 0,
        message: `超大圈复杂度: 函数圈复杂度 ${complexity} 超过限制 ${cfg.maxCyclomaticComplexity}`
      });
    }
  }

  return results;
}

export const oversizedHeaderRule: Rule = {
  id: 'a34ef4596d6511edab16fa163e0fa374',
  name: '超大头文件',
  severity: 'warning',
  check(source: string, filePath: string): RuleMatch[] {
    if (!filePath.endsWith('.h') && !filePath.endsWith('.hpp')) return [];
    const lines = getLines(source);
    const max = getConfig().maxHeaderLines;
    if (lines.length > max) {
      return [{ ruleId: this.id, line: 0, col: 0, message: `超大头文件: 头文件行数 ${lines.length} 超过限制 ${max}，请拆分头文件` }];
    }
    return [];
  }
};

export const oversizedSourceRule: Rule = {
  id: 'a3f65f386d6511edab16fa163e0fa374',
  name: '超大源文件',
  severity: 'warning',
  check(source: string, filePath: string): RuleMatch[] {
    if (filePath.endsWith('.h') || filePath.endsWith('.hpp')) return [];
    const lines = getLines(source);
    const max = getConfig().maxSourceLines;
    if (lines.length > max) {
      return [{ ruleId: this.id, line: 0, col: 0, message: `超大源文件: 源文件行数 ${lines.length} 超过限制 ${max}，请拆分源文件` }];
    }
    return [];
  }
};

export const oversizedFunctionRule: Rule = {
  id: 'a3a2d2f96d6511edab16fa163e0fa374',
  name: '超大函数',
  severity: 'warning',
  check(source: string): RuleMatch[] {
    return analyzeFunctionMetrics(source).filter(match => match.ruleId === this.id);
  }
};

export const oversizedNestingRule: Rule = {
  id: 'a2a6917f6d6511edab16fa163e0fa374',
  name: '超大深度函数',
  severity: 'warning',
  check(source: string): RuleMatch[] {
    return analyzeFunctionMetrics(source).filter(match => match.ruleId === this.id);
  }
};

export const oversizedComplexityRule: Rule = {
  id: 'a1fed4856d6511edab16fa163e0fa374',
  name: '超大圈复杂度',
  severity: 'warning',
  check(source: string): RuleMatch[] {
    return analyzeFunctionMetrics(source).filter(match => match.ruleId === this.id);
  }
};
