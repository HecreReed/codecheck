import { Rule, RuleMatch } from '../types';
import { tokenize, getLines } from '../../utils/tokenizer';
import { hashContent } from '../../utils/fileUtils';

// 告警抑制: warning suppression pragmas
export const warningSuppressRule: Rule = {
  id: 'a4f056c86d6511edab16fa163e0fa374',
  name: '告警抑制',
  severity: 'warning',
  check(source: string): RuleMatch[] {
    const lines = getLines(source);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      if (/^\s*#\s*pragma\s+warning\s*\(\s*disable/i.test(line) ||
          /\/\/\s*NOLINT|\/\/\s*NOSONAR|\/\*\s*NOLINT/.test(line) ||
          /^\s*#\s*pragma\s+GCC\s+diagnostic\s+ignored/.test(line)) {
        results.push({
          ruleId: this.id, line: i, col: 0,
          message: '告警抑制: 检测到告警抑制指令，应修复根本问题而非抑制告警',
          fix: {
            label: '删除告警抑制',
            edits: [
              {
                newText: '',
                range: { line: i, col: 0, endLine: i + 1, endCol: 0 }
              }
            ]
          }
        });
      }
    });
    return results;
  }
};

// 冗余代码: unreachable code after return/break/continue/throw
export const redundantCodeRule: Rule = {
  id: 'a449b5946d6511edab16fa163e0fa374',
  name: '冗余代码',
  severity: 'warning',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      if (/^\s*(return|break|continue|throw)\b.*;/.test(line)) {
        const next = lines[i + 1];
        if (next && /^\s*[^}\s{#]/.test(next) && !/^\s*(case|default)\b/.test(next)) {
          results.push({ ruleId: this.id, line: i + 1, col: 0, message: '冗余代码: 此行代码在 return/break/continue/throw 之后，永远不会被执行' });
        }
      }
    });
    return results;
  }
};

// 重复代码: duplicate code blocks (rolling hash over 10-line windows)
// This is a workspace-level check; per-file we detect repeated blocks within the same file
export const duplicateCodeRule: Rule = {
  id: 'a102dade6d6511edab16fa163e0fa374',
  name: '重复代码',
  severity: 'warning',
  check(source: string): RuleMatch[] {
    const lines = getLines(source);
    const results: RuleMatch[] = [];
    const WINDOW = 10;
    if (lines.length < WINDOW * 2) return [];

    const hashes = new Map<string, number>();
    for (let i = 0; i <= lines.length - WINDOW; i++) {
      const block = lines.slice(i, i + WINDOW)
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('//'))
        .join('\n');
      if (block.length < 100) continue; // skip trivial blocks
      const h = hashContent(block);
      if (hashes.has(h)) {
        const firstLine = hashes.get(h)!;
        results.push({ ruleId: this.id, line: i, col: 0, message: `重复代码: 第 ${i + 1}-${i + WINDOW} 行与第 ${firstLine + 1}-${firstLine + WINDOW} 行代码重复` });
      } else {
        hashes.set(h, i);
      }
    }
    return results;
  }
};
