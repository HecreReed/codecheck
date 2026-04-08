import { Rule, RuleMatch } from '../types';
import { tokenize, getLines } from '../../utils/tokenizer';
import { extractFunctionCall } from '../../utils/cppUtils';

export const SECURE_FUNCS = [
  'memcpy_s', 'memmove_s', 'strcpy_s', 'strncpy_s', 'strcat_s', 'strncat_s',
  'sprintf_s', 'snprintf_s', 'scanf_s', 'sscanf_s', 'fopen_s', 'freopen_s',
  'tmpfile_s', 'gets_s', 'strtok_s', 'asctime_s', 'ctime_s', 'gmtime_s', 'localtime_s'
];

const APPROVED_HEADERS = ['securec.h', 'securectype.h', 'huawei_securec.h'];
const SECURE_FUNC_RE = new RegExp(`\\b(${SECURE_FUNCS.join('|')})\\s*\\(`);
const COPY_LIKE_SECURE_FUNCS = new Set([
  'memcpy_s', 'memmove_s', 'strcpy_s', 'strncpy_s', 'strcat_s', 'strncat_s', 'sprintf_s', 'snprintf_s'
]);

function isMaxConstant(expr: string): boolean {
  return /0xFFFFFFFF|INT_MAX|UINT_MAX|0x7FFFFFFF/.test(expr);
}

function toIntegerLiteral(expr: string): number | undefined {
  const trimmed = expr.trim();
  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    return Number.parseInt(trimmed, 16);
  }
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  return undefined;
}

function normalizeExpr(expr: string): string {
  return expr.replace(/\s+/g, '');
}

function referencesSourceBuffer(expr: string, sourceExpr: string | undefined): boolean {
  if (!sourceExpr) {
    return false;
  }
  const normalizedDestMax = normalizeExpr(expr);
  const normalizedSource = normalizeExpr(sourceExpr);
  if (normalizedSource.length === 0) {
    return false;
  }
  return normalizedDestMax.includes(normalizedSource);
}

function looksLikeCustomSecureFunctionDefinition(line: string): string | undefined {
  const match = line.match(/^\s*(?:template\s*<[^>]+>\s*)?(?:[\w:\<\>\*&\s]+)\b([A-Za-z_]\w*_s)\s*\([^;]*\)\s*(?:const\s*)?\{/);
  if (!match) {
    return undefined;
  }
  return match[1];
}

// G.FUU.11: must check return value of security functions
export const checkSecureFuncReturnRule: Rule = {
  id: 'd4187e036d6511edab16fa163e0fa374',
  name: 'G.FUU.11 必须检查安全函数返回值',
  severity: 'warning',
  aliases: ['cd9599846d6511edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(SECURE_FUNC_RE);
      if (m) {
        const trimmed = line.trim();
        if (!/(if|while|for)\s*\(/.test(trimmed) &&
            !/^\s*(int|errno_t|BOOL|bool|HRESULT|\w+_t)\s+\w+\s*=/.test(trimmed) &&
            !/^\s*\w+\s*=\s*/.test(trimmed) &&
            !/^\s*(ret|result|rc|err|status|rv)\b/.test(trimmed)) {
          results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.FUU.11: 安全函数 '${m[1]}' 的返回值必须检查并正确处理` });
        }
      }
    });
    return results;
  }
};

// G.FUU.12: destMax/count coherence
export const destMaxAndCountRule: Rule = {
  id: 'c81a55bf6d6511edab16fa163e0fa374',
  name: 'G.FUU.12 正确设置安全函数中的destMax参数--检查destMax和count参数',
  severity: 'error',
  aliases: ['d08283ba6d6511edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];

    lines.forEach((line, i) => {
      const call = extractFunctionCall(line, SECURE_FUNCS);
      if (!call || call.args.length < 2) {
        return;
      }

      const destMaxExpr = call.args[1];
      const countExpr = call.args.length >= 4 ? call.args[3] : call.args[call.args.length - 1];
      const destMaxValue = toIntegerLiteral(destMaxExpr);
      const countValue = toIntegerLiteral(countExpr);

      if (isMaxConstant(destMaxExpr)) {
        results.push({
          ruleId: this.id,
          line: i,
          col: 0,
          message: 'G.FUU.12: 安全函数的 destMax 参数不应设置为最大值常量，应使用 sizeof(dest) 或实际缓冲区大小'
        });
        return;
      }

      if (destMaxValue !== undefined && countValue !== undefined && countValue > destMaxValue) {
        results.push({
          ruleId: this.id,
          line: i,
          col: 0,
          message: `G.FUU.12: 安全函数 '${call.name}' 的 count 参数 ${countValue} 超过 destMax ${destMaxValue}`
        });
        return;
      }

      if (COPY_LIKE_SECURE_FUNCS.has(call.name) && /strlen\s*\(/.test(countExpr) && !/\+\s*1\b/.test(countExpr)) {
        results.push({
          ruleId: this.id,
          line: i,
          col: 0,
          message: `G.FUU.12: 安全函数 '${call.name}' 的 count 参数基于 strlen() 时应考虑结束符空间`
        });
      }
    });

    return results;
  }
};

// G.FUU.12: correctness of destMax itself
export const destMaxCorrectRule: Rule = {
  id: 'd224fda76d6511edab16fa163e0fa374',
  name: 'G.FUU.12 正确设置安全函数中的destMax参数--检查destMax参数是否设置正确',
  severity: 'error',
  aliases: ['caa511e36d6511edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];

    lines.forEach((line, i) => {
      const call = extractFunctionCall(line, SECURE_FUNCS);
      if (!call || call.args.length < 2) {
        return;
      }

      const destExpr = call.args[0];
      const destMaxExpr = call.args[1];
      const srcExpr = call.args.length >= 3 ? call.args[2] : undefined;

      if (/^0+$/.test(destMaxExpr.trim())) {
        results.push({
          ruleId: this.id,
          line: i,
          col: 0,
          message: `G.FUU.12: 安全函数 '${call.name}' 的 destMax 参数不能为 0`
        });
        return;
      }

      if (isMaxConstant(destMaxExpr) ||
          referencesSourceBuffer(destMaxExpr, srcExpr) ||
          (/strlen\s*\(/.test(destMaxExpr) && referencesSourceBuffer(destMaxExpr, srcExpr))) {
        results.push({
          ruleId: this.id,
          line: i,
          col: 0,
          message: `G.FUU.12: 安全函数 '${call.name}' 的 destMax 参数应基于目标缓冲区 '${destExpr.trim()}' 的大小计算`
        });
      }
    });

    return results;
  }
};

// G.FUU.13: no wrapping of security functions
export const wrapSecureFuncRule: Rule = {
  id: 'c2075a476d6b11edab16fa163e0fa374',
  name: 'G.FUU.13 禁止封装安全函数',
  severity: 'error',
  aliases: ['bc8b84fe6d6b11edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    let inFunc = false;
    let braceDepth = 0;
    let funcStartLine = 0;
    let bodyLines: string[] = [];

    lines.forEach((line, i) => {
      for (const ch of line) {
        if (ch === '{') {
          if (braceDepth === 0) {
            inFunc = true;
            funcStartLine = i;
            bodyLines = [];
          }
          braceDepth++;
        } else if (ch === '}') {
          braceDepth--;
          if (braceDepth === 0 && inFunc) {
            const body = bodyLines.join('\n');
            const secureCalls = (body.match(SECURE_FUNC_RE) || []).length;
            const totalStatements = (body.match(/;/g) || []).length;
            if (secureCalls > 0 && totalStatements <= 3 && secureCalls >= totalStatements - 1) {
              results.push({ ruleId: this.id, line: funcStartLine, col: 0, message: 'G.FUU.13: 禁止封装安全函数，应直接调用安全函数库中的函数' });
            }
            inFunc = false;
          }
        }
      }
      if (inFunc) {
        bodyLines.push(line);
      }
    });

    return results;
  }
};

// G.FUU.14: no macro renaming of security functions
export const macroRenameSecureFuncRule: Rule = {
  id: 'dc824b3e2a3411eeab16fa163e0fa374',
  name: 'G.FUU.14 禁止用宏重命名安全函数',
  severity: 'warning',
  aliases: ['dc82c7582a3411eeab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const lines = getLines(source);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(/^\s*#\s*define\s+\w+\s+(\w+)/);
      if (m && SECURE_FUNCS.includes(m[1])) {
        results.push({ ruleId: this.id, line: i, col: 0, message: `G.FUU.14: 禁止用宏重命名安全函数 '${m[1]}'` });
      }
    });
    return results;
  }
};

// G.FUU.15: security functions must come from approved library
export const secureLibraryRule: Rule = {
  id: 'c25b28246d6b11edab16fa163e0fa374',
  name: 'G.FUU.15 只能使用华为安全函数库中的安全函数',
  severity: 'error',
  aliases: ['bd09865a6d6b11edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    const hasApprovedHeader = APPROVED_HEADERS.some(header => source.includes(header));
    if (!hasApprovedHeader) {
      lines.forEach((line, i) => {
        const m = line.match(SECURE_FUNC_RE);
        if (m) {
          results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.FUU.15: 安全函数 '${m[1]}' 必须来自华为安全函数库（需包含 securec.h）` });
        }
      });
    }
    return results;
  }
};

// G.FUU.15: user-defined secure-like functions are not allowed
export const customSecureFunctionRule: Rule = {
  id: 'bd86d9376d6b11edab16fa163e0fa374',
  name: 'G.FUU.15 只能使用华为安全函数库中的安全函数或经华为认可的其他安全函数--检查用户自定义类安全函数',
  severity: 'warning',
  aliases: ['c2aefa096d6b11edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];

    lines.forEach((line, i) => {
      const funcName = looksLikeCustomSecureFunctionDefinition(line);
      if (funcName && !SECURE_FUNCS.includes(funcName)) {
        results.push({
          ruleId: this.id,
          line: i,
          col: 0,
          message: `G.FUU.15: 检测到用户自定义安全函数 '${funcName}'，应直接使用经认可的安全函数库实现`
        });
      }
    });

    return results;
  }
};
