import { Rule, RuleMatch } from '../types';
import { tokenize, getLines } from '../../utils/tokenizer';

// G.EXP.33-CPP: double increment/decrement in same expression
export const doubleIncrementRule: Rule = {
  id: '13a229b16d6511edab16fa163e0fa374',
  name: 'G.EXP.33-CPP 含有变量自增或自减运算的表达式中禁止再次引用该变量',
  severity: 'error',
  aliases: ['81e34e576d6511edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      // Detect patterns like: a++ + a, ++a + a, a[i++] + i, etc.
      const m = line.match(/\b(\w+)\s*(\+\+|--)|(\+\+|--)\s*(\w+)/);
      if (m) {
        const varName = m[1] || m[4];
        // Check if same variable appears again in the expression
        const re = new RegExp(`\\b${varName}\\b`, 'g');
        const matches = [...line.matchAll(re)];
        if (matches.length >= 2) {
          results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.EXP.33-CPP: 变量 '${varName}' 在含有自增/自减的表达式中被多次引用，行为未定义` });
        }
      }
    });
    return results;
  }
};

// G.EXP.22-CPP: division by zero risk
export const divisionByZeroRule: Rule = {
  id: 'c92a3ead6d6511edab16fa163e0fa374',
  name: 'G.EXP.22-CPP 确保除法和余数运算不会导致除零错误',
  severity: 'error',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const codeLine = line.replace(/"(?:[^"\\]|\\.)*"/g, '""');
      // Division or modulo where denominator is a variable (not a literal non-zero)
      const m = codeLine.match(/[^/]\s*\/\s*(\w+)\s*[^/=]|[^%]\s*%\s*(\w+)/);
      if (m) {
        const denom = m[1] || m[2];
        // Skip if denominator is a non-zero literal
        if (!/^\d+$/.test(denom) || denom === '0') {
          // Check if there's a zero-check for this variable in preceding lines
          const prev = lines.slice(Math.max(0, i - 10), i).join('\n');
          if (!new RegExp(`${denom}\\s*[!=]=\\s*0|${denom}\\s*>\\s*0|0\\s*[!=]=\\s*${denom}`).test(prev)) {
            results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.EXP.22-CPP: 除数 '${denom}' 在使用前未检查是否为零` });
          }
        }
      }
    });
    return results;
  }
};

// G.EXP.05-CPP / G.INC.07: extern declaration (handled in preprocessor.ts, re-exported here for expressions)

// G.EXP.26-CPP: integer widening before comparison
export const integerWideningRule: Rule = {
  id: 'cb22d6926d6511edab16fa163e0fa374',
  name: 'G.EXP.26-CPP 整型表达式比较或赋值为更大类型之前必须用更大类型求值',
  severity: 'warning',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      // Detect: (long/int64_t) = int_expr * int_expr without cast
      const m = line.match(/\b(long\s+long|int64_t|uint64_t|long)\s+\w+\s*=\s*(\w+)\s*[\*\+\-]\s*(\w+)/);
      if (m) {
        // If neither operand has a cast to the wider type, flag it
        if (!/(long\s+long|int64_t|uint64_t|long)\s*\(/.test(line) && !/\(long\b|\(int64_t\b/.test(line)) {
          results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: 'G.EXP.26-CPP: 整型表达式赋值给更大类型前，应先将操作数转换为目标类型再运算，避免溢出' });
        }
      }
    });
    return results;
  }
};
