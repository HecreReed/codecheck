import { Rule, RuleMatch } from '../types';
import { tokenize, getLines } from '../../utils/tokenizer';

// G.CTL.03: loops must have safe exit
export const safeLoopExitRule: Rule = {
  id: 'c0cd46fd6d6b11edab16fa163e0fa374',
  name: 'G.CTL.03 循环必须安全退出',
  severity: 'info',
  aliases: ['b64bfd336d6b11edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      if (/\bwhile\s*\(\s*(true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/.test(line)) {
        // Look for break/return/goto/throw within the next 50 lines at same or deeper depth
        const body = lines.slice(i + 1, i + 51).join('\n');
        if (!/\b(break|return|goto|throw)\b/.test(body)) {
          results.push({ ruleId: this.id, line: i, col: 0, message: 'G.CTL.03: 无限循环必须包含安全退出条件（break/return/throw/goto）' });
        }
      }
    });
    return results;
  }
};

// G.AST.03: no assert for runtime errors
export const assertRuntimeRule: Rule = {
  id: 'c12175f36d6b11edab16fa163e0fa374',
  name: 'G.AST.03 禁止用断言检测程序在运行期间可能导致的错误',
  severity: 'warning',
  aliases: ['b81b24b76d6b11edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      if (/\bstatic_assert\s*\(/.test(line)) {
        return;
      }

      const m = line.match(/\bassert\s*\(/);
      if (m) {
        results.push({
          ruleId: this.id,
          line: i,
          col: m.index ?? 0,
          message: 'G.AST.03: 禁止使用 assert 处理运行期间可能发生的错误，应改为显式错误处理逻辑'
        });
      }
    });
    return results;
  }
};
