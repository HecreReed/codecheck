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
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    const WINDOW = 12;
    const MIN_BLOCK_CHARS = 120;
    const meaningfulLines = lines
      .map((line, lineNumber) => ({
        lineNumber,
        text: line.replace(/\s+/g, ' ').trim(),
      }))
      .filter(item => item.text.length > 0 && !item.text.startsWith('#'));

    if (meaningfulLines.length < WINDOW * 2) return [];

    const hashes = new Map<string, number>();
    for (let i = 0; i <= meaningfulLines.length - WINDOW; ) {
      const blockLines = meaningfulLines.slice(i, i + WINDOW).map(item => item.text);
      const uniqueLineCount = new Set(blockLines).size;
      const block = blockLines.join('\n');
      if (block.length < MIN_BLOCK_CHARS || uniqueLineCount < Math.ceil(WINDOW / 2)) {
        i++;
        continue;
      }

      const h = hashContent(block);
      const previousIndex = hashes.get(h);
      if (previousIndex === undefined) {
        hashes.set(h, i);
        i++;
        continue;
      }

      if (Math.abs(previousIndex - i) < WINDOW) {
        i++;
        continue;
      }

      let extension = WINDOW;
      while (
        previousIndex + extension < meaningfulLines.length &&
        i + extension < meaningfulLines.length &&
        meaningfulLines[previousIndex + extension].text === meaningfulLines[i + extension].text
      ) {
        extension++;
      }

      const currentStart = meaningfulLines[i].lineNumber;
      const currentEnd = meaningfulLines[i + extension - 1].lineNumber;
      const previousStart = meaningfulLines[previousIndex].lineNumber;
      const previousEnd = meaningfulLines[previousIndex + extension - 1].lineNumber;
      results.push({
        ruleId: this.id,
        line: currentStart,
        col: 0,
        message: `重复代码: 第 ${currentStart + 1}-${currentEnd + 1} 行与第 ${previousStart + 1}-${previousEnd + 1} 行代码重复`
      });
      i += extension;
    }
    return results;
  }
};
