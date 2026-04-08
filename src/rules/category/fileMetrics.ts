import { Rule, RuleMatch } from '../types';
import { getLines } from '../../utils/tokenizer';
import * as vscode from 'vscode';

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('cppChecker');
  return {
    maxHeaderLines: cfg.get<number>('maxHeaderLines', 1000),
    maxSourceLines: cfg.get<number>('maxSourceLines', 2000),
    maxFunctionLines: cfg.get<number>('maxFunctionLines', 80),
    maxNestingDepth: cfg.get<number>('maxNestingDepth', 5),
    maxCyclomaticComplexity: cfg.get<number>('maxCyclomaticComplexity', 10),
  };
}

function analyzeFunctionMetrics(source: string): RuleMatch[] {
  const cfg = getConfig();
  const lines = getLines(source);
  const results: RuleMatch[] = [];
  const COMPLEXITY_RE = /\b(if|else\s+if|for|while|case|catch)\b|&&|\|\|/g;

  let braceDepth = 0;
  let funcStartLine = -1;
  let maxDepthInFunc = 0;
  let complexity = 1;

  lines.forEach((line, i) => {
    if (braceDepth === 0 && /\)\s*(const\s*)?(noexcept\s*)?(override\s*)?(final\s*)?\{/.test(line)) {
      funcStartLine = i;
      maxDepthInFunc = 0;
      complexity = 1;
    }

    for (const ch of line) {
      if (ch === '{') {
        braceDepth++;
        if (funcStartLine >= 0) {
          maxDepthInFunc = Math.max(maxDepthInFunc, braceDepth);
        }
      } else if (ch === '}') {
        braceDepth--;
        if (braceDepth === 0 && funcStartLine >= 0) {
          const funcLines = i - funcStartLine + 1;

          if (funcLines > cfg.maxFunctionLines) {
            results.push({
              ruleId: 'a3a2d2f96d6511edab16fa163e0fa374',
              line: funcStartLine,
              col: 0,
              message: `超大函数: 函数长度 ${funcLines} 行超过限制 ${cfg.maxFunctionLines} 行`
            });
          }
          if (maxDepthInFunc > cfg.maxNestingDepth) {
            results.push({
              ruleId: 'a2a6917f6d6511edab16fa163e0fa374',
              line: funcStartLine,
              col: 0,
              message: `超大深度函数: 函数最大嵌套深度 ${maxDepthInFunc} 超过限制 ${cfg.maxNestingDepth}`
            });
          }
          if (complexity > cfg.maxCyclomaticComplexity) {
            results.push({
              ruleId: 'a1fed4856d6511edab16fa163e0fa374',
              line: funcStartLine,
              col: 0,
              message: `超大圈复杂度: 函数圈复杂度 ${complexity} 超过限制 ${cfg.maxCyclomaticComplexity}`
            });
          }
          funcStartLine = -1;
        }
      }
    }

    if (funcStartLine >= 0 && braceDepth > 0) {
      const matches = line.match(COMPLEXITY_RE);
      if (matches) {
        complexity += matches.length;
      }
    }
  });

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
