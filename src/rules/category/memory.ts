import { Rule, RuleMatch } from '../types';
import { tokenize, getLines } from '../../utils/tokenizer';

// G.FUU.10: no alloca()
export const allocaRule: Rule = {
  id: 'c1b3c9386d6b11edab16fa163e0fa374',
  name: 'G.FUU.10 禁止使用alloca()函数',
  severity: 'error',
  aliases: ['bc0ccf106d6b11edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(/\balloca\s*\(/);
      if (m) {
        results.push({
          ruleId: this.id, line: i, col: m.index ?? 0,
          message: 'G.FUU.10: 禁止使用 alloca() 申请栈内存，请使用固定大小数组或 std::vector'
        });
      }
    });
    return results;
  }
};

// G.FUU.09: no realloc()
export const reallocRule: Rule = {
  id: '6237d63384f511edafd1fa163ef7e846',
  name: 'G.FUU.09 禁止使用realloc()函数',
  severity: 'error',
  aliases: ['bb8fdc236d6b11edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(/\brealloc\s*\(/);
      if (m) {
        results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: 'G.FUU.09: 禁止使用 realloc()，请使用 malloc/free 重新分配' });
      }
    });
    return results;
  }
};

// G.FUU.21: unsafe memory functions
const UNSAFE_MEM_FUNCS = ['memcpy\\b', 'strcpy\\b', 'strcat\\b', 'sprintf\\b', 'gets\\b', 'scanf\\b', 'vsprintf\\b', 'strncpy\\b'];
const UNSAFE_MEM_RE = new RegExp(`\\b(${UNSAFE_MEM_FUNCS.map(f => f.replace('\\b', '')).join('|')})\\s*\\(`);

export const unsafeMemFuncRule: Rule = {
  id: 'd51281346d6511edab16fa163e0fa374',
  name: 'G.FUU.21 禁止使用内存操作类不安全函数',
  severity: 'warning',
  aliases: ['cf0bb3c76d6511edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(UNSAFE_MEM_RE);
      if (m) {
        results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.FUU.21: 禁止使用不安全函数 '${m[1]}'，请使用对应的安全函数（如 memcpy_s, strcpy_s 等）` });
      }
    });
    return results;
  }
};

// G.MEM.04: sensitive memory not zeroed
const SENSITIVE_VAR_RE = /\b(password|passwd|secret|key|token|credential|private_key|privatekey)\w*\b/i;

export const sensitiveMemoryRule: Rule = {
  id: 'd46ba0b26d6511edab16fa163e0fa374',
  name: 'G.MEM.04 内存中的敏感信息使用完毕后立即清0',
  severity: 'error',
  aliases: ['ce1278d26d6511edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(SENSITIVE_VAR_RE);
      if (m && /\bchar\b|\buint8_t\b|\bbyte\b/.test(line) && /\[/.test(line)) {
        // Check if memset/SecureZeroMemory appears nearby (within 20 lines after)
        const window = lines.slice(i, i + 20).join('\n');
        if (!/memset|SecureZeroMemory|explicit_bzero|memset_s/.test(window)) {
          results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.MEM.04: 敏感信息变量 '${m[0]}' 使用完毕后应立即清零（memset/SecureZeroMemory）` });
        }
      }
    });
    return results;
  }
};

// G.RES.02-CPP: memory allocation without size validation
export const memAllocValidationRule: Rule = {
  id: 'd4bf3f6d6d6511edab16fa163e0fa374',
  name: 'G.RES.02-CPP 内存申请前必须对申请内存大小进行合法性校验',
  severity: 'error',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      if (/\b(malloc|calloc|new\b)\s*[\(\[]/.test(line)) {
        // Check if there's a size check in the preceding 5 lines
        const prev = lines.slice(Math.max(0, i - 5), i).join('\n');
        if (!/if\s*\(.*[><=!]/.test(prev) && !/assert\s*\(/.test(prev)) {
          results.push({ ruleId: this.id, line: i, col: 0, message: 'G.RES.02-CPP: 内存申请前必须对申请大小进行合法性校验（如 if (size > 0 && size < MAX)）' });
        }
      }
    });
    return results;
  }
};

// G.ARR.03: sizeof on pointer variable
export const sizeofPointerRule: Rule = {
  id: 'cc9a95906d6511edab16fa163e0fa375',
  name: 'G.ARR.03 禁止通过对指针变量进行sizeof操作来获取数组大小',
  severity: 'warning',
  aliases: ['cc9a95906d6511edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      // sizeof(ptr) where ptr is a pointer (heuristic: ends with * in declaration context)
      const m = line.match(/\bsizeof\s*\(\s*(\w+)\s*\)/);
      if (m) {
        // Check if the variable was declared as a pointer in preceding lines
        const varName = m[1];
        const prev = lines.slice(Math.max(0, i - 20), i).join('\n');
        if (new RegExp(`\\*\\s*${varName}\\b|${varName}\\s*=.*malloc|${varName}\\s*=.*new\\b`).test(prev)) {
          results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.ARR.03: 对指针变量 '${varName}' 使用 sizeof 无法获取数组大小，请使用数组长度变量或 std::size()` });
        }
      }
    });
    return results;
  }
};
