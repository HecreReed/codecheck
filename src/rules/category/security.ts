import { Rule, RuleMatch } from '../types';
import { tokenize, getLines } from '../../utils/tokenizer';
import {
  extractFunctionCall,
  inferArgumentKind,
  parseFormatSpecifiers,
  parseStringLiteral,
} from '../../utils/cppUtils';

const UNSAFE_ALGOS = ['MD5', 'SHA1', 'SHA-1', 'DES', 'RC4', 'RC2', 'ECB', '3DES', 'TDES', 'BLOWFISH'];
const UNSAFE_ALGO_RE = new RegExp(`\\b(${UNSAFE_ALGOS.join('|')})\\b`);
const FORMAT_FUNCTIONS = ['printf', 'fprintf', 'sprintf', 'snprintf', 'scanf', 'sscanf', 'fscanf'];

function getFormatArguments(functionName: string, args: string[]): { formatArg: string | undefined; valueArgs: string[] } {
  if (functionName === 'fprintf' || functionName === 'fscanf') {
    return { formatArg: args[1], valueArgs: args.slice(2) };
  }
  if (functionName === 'sprintf') {
    return { formatArg: args[1], valueArgs: args.slice(2) };
  }
  if (functionName === 'snprintf') {
    return { formatArg: args[2], valueArgs: args.slice(3) };
  }
  if (functionName === 'sscanf') {
    return { formatArg: args[1], valueArgs: args.slice(2) };
  }
  return { formatArg: args[0], valueArgs: args.slice(1) };
}

export const unsafeAlgorithmRule: Rule = {
  id: 'dc82b75b2a3411eeab16fa163e0fa374',
  name: '不安全IPSI算法检查',
  severity: 'fatal',
  check(source: string): RuleMatch[] {
    const lines = getLines(source);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(UNSAFE_ALGO_RE);
      if (m) {
        results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `不安全算法: 检测到不安全的加密算法 '${m[1]}'，请使用 AES-256、SHA-256 等安全算法` });
      }
    });
    return results;
  }
};

export const externalDataProcessStartRule: Rule = {
  id: 'd0d5ad126d6511edab16fa163e0fa374',
  name: 'G.STD.15-CPP 禁止外部可控数据作为进程启动函数的参数',
  severity: 'fatal',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      if (/\b(system|popen|execl|execle|execlp|execv|execve|execvp|execvpe|dlopen|LoadLibrary|LoadLibraryEx)\s*\(/.test(line)) {
        if (!/\(\s*"[^"]*"\s*[,)]/.test(line)) {
          results.push({ ruleId: this.id, line: i, col: 0, message: 'G.STD.15-CPP: 禁止将外部可控数据作为进程启动函数或模块加载函数的参数' });
        }
      }
    });
    return results;
  }
};

export const stdStringForSensitiveRule: Rule = {
  id: 'd706cbec6d6511edab16fa163e0fa374',
  name: 'G.STD.07-CPP 禁止使用std::string存储敏感信息',
  severity: 'error',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      if (/\bstd::string\b|\bstring\b/.test(line) &&
          /\b(password|passwd|secret|key|token|credential|private_key)\b/i.test(line)) {
        results.push({ ruleId: this.id, line: i, col: 0, message: 'G.STD.07-CPP: 禁止使用 std::string 存储敏感信息（密码、密钥等），应使用安全内存容器并在使用后清零' });
      }
    });
    return results;
  }
};

export const formatStringRule: Rule = {
  id: 'd17cd82e6d6511edab16fa163e0fa374',
  name: 'G.STD.13-CPP 调用格式化输入/输出函数时使用有效的格式字符串',
  severity: 'error',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const call = extractFunctionCall(line, FORMAT_FUNCTIONS);
      if (!call) {
        return;
      }

      const { formatArg } = getFormatArguments(call.name, call.args);
      if (formatArg && parseStringLiteral(formatArg) === undefined) {
        results.push({
          ruleId: this.id,
          line: i,
          col: 0,
          message: `G.STD.13-CPP: '${call.name}' 的格式字符串应为字符串字面量，禁止使用变量作为格式字符串`
        });
      }
    });
    return results;
  }
};

export const formatTypeMismatchRule: Rule = {
  id: 'd1d0b9a96d6511edab16fa163e0fa374',
  name: 'G.STD.13-CPP 调用格式化输入/输出函数时，使用有效的格式字符串--格式化类型不匹配',
  severity: 'error',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];

    lines.forEach((line, i) => {
      const call = extractFunctionCall(line, FORMAT_FUNCTIONS);
      if (!call) {
        return;
      }

      const { formatArg, valueArgs } = getFormatArguments(call.name, call.args);
      if (!formatArg) {
        return;
      }

      const formatString = parseStringLiteral(formatArg);
      if (!formatString) {
        return;
      }

      const specifiers = parseFormatSpecifiers(formatString);
      const comparableCount = Math.min(specifiers.length, valueArgs.length);
      for (let index = 0; index < comparableCount; index++) {
        const specifier = specifiers[index];
        const argument = valueArgs[index];
        const argumentKind = inferArgumentKind(argument);
        if (specifier.kind !== 'unknown' &&
            argumentKind !== 'unknown' &&
            specifier.kind !== argumentKind) {
          results.push({
            ruleId: this.id,
            line: i,
            col: 0,
            message: `G.STD.13-CPP: 格式说明符 '${specifier.raw}' 与参数 '${argument.trim()}' 的类型不匹配`
          });
          return;
        }
      }
    });

    return results;
  }
};

export const exitFuncRule: Rule = {
  id: 'bfd15e036d6b11edab16fa163e0fa374',
  name: 'G.STD.16-CPP 禁用程序与线程的退出函数和atexit函数',
  severity: 'error',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(/\b(exit|_exit|_Exit|abort|atexit|quick_exit|at_quick_exit|thrd_exit)\s*\(/);
      if (m) {
        results.push({
          ruleId: this.id,
          line: i,
          col: m.index ?? 0,
          message: `G.STD.16-CPP: 禁止使用 '${m[1]}' 函数，应使用正常的函数返回流程进行清理`
        });
      }
    });
    return results;
  }
};

export const killProcessRule: Rule = {
  id: 'c024d38e6d6b11edab16fa163e0fa374',
  name: 'G.STD.17-CPP 禁止调用kill、TerminateProcess函数直接终止其他进程',
  severity: 'error',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(/\b(kill|TerminateProcess)\s*\(/);
      if (m) {
        results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.STD.17-CPP: 禁止使用 '${m[1]}' 直接终止其他进程` });
      }
    });
    return results;
  }
};

export const raceconditionRule: Rule = {
  id: '623ceb5484f511edafd1fa163ef7e846',
  name: 'G.STD.18-CPP 使用库函数时避免竞争条件',
  severity: 'warning',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      if (/\b(tmpnam|mktemp|access|stat)\s*\(/.test(line)) {
        results.push({ ruleId: this.id, line: i, col: 0, message: 'G.STD.18-CPP: 使用 tmpnam/mktemp/access 等函数存在竞争条件风险，请使用 mkstemp 或原子操作替代' });
      }
    });
    return results;
  }
};

const PUBLIC_IP_RE = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/;
const PUBLIC_URL_RE = /https?:\/\/(?!localhost|127\.0\.0\.1|10\.\d|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\S+/;

export const publicAddressRule: Rule = {
  id: 'c356f2166d6b11edab16fa163e0fa374',
  name: 'G.OTH.05 禁止代码中包含公网地址',
  severity: 'error',
  aliases: ['14b29666d5af11edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const lines = getLines(source);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      let m = line.match(PUBLIC_IP_RE);
      if (m) {
        results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.OTH.05: 代码中包含公网IP地址 '${m[0]}'，禁止硬编码公网地址` });
        return;
      }
      m = line.match(PUBLIC_URL_RE);
      if (m) {
        results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.OTH.05: 代码中包含公网URL '${m[0]}'，禁止硬编码公网地址` });
      }
    });
    return results;
  }
};

export const randSecurityRule: Rule = {
  id: 'cf8828826d6511edab16fa163e0fa374',
  name: 'G.OTH.03 禁用rand函数产生用于安全用途的伪随机数',
  severity: 'warning',
  aliases: ['d565b5396d6511edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(/\brand\s*\(\s*\)/);
      if (m) {
        results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: 'G.OTH.03: 禁止使用 rand() 产生用于安全用途的随机数，请使用 /dev/urandom 或密码学安全随机数生成器' });
      }
    });
    return results;
  }
};

export const bufferSizeRule: Rule = {
  id: 'd3c4f7356d6511edab16fa163e0fa374',
  name: 'G.STD.05-CPP 确保字符串缓冲区有足够空间',
  severity: 'error',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(/\bchar\s+\w+\s*\[\s*(\d+)\s*\]/);
      if (m && Number.parseInt(m[1], 10) < 4) {
        results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `G.STD.05-CPP: 字符串缓冲区大小 ${m[1]} 可能不足以容纳字符串数据和null终止符` });
      }
    });
    return results;
  }
};

export const tempFileSharedDirRule: Rule = {
  id: 'be8399c86d6b11edab16fa163e0fa374',
  name: 'G.FIL.03 不要在共享目录中创建临时文件',
  severity: 'error',
  aliases: ['c30393756d6b11edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const lines = getLines(source);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      if (/\b(fopen|open|creat)\s*\(/.test(line) && /["'](\/tmp\/|\/var\/tmp\/|\/dev\/shm\/)/.test(line)) {
        results.push({ ruleId: this.id, line: i, col: 0, message: 'G.FIL.03: 不要在共享目录（/tmp等）中创建临时文件，请使用 mkstemp() 或应用私有目录' });
      }
    });
    return results;
  }
};

const GENERAL_UNSAFE = ['gets', 'scanf', 'vscanf', 'vfscanf', 'sprintf', 'vsprintf', 'strcpy', 'strcat', 'strtok', 'asctime', 'ctime', 'gmtime', 'localtime', 'tmpnam', 'mktemp'];
const GENERAL_UNSAFE_RE = new RegExp(`\\b(${GENERAL_UNSAFE.join('|')})\\s*\\(`);

export const generalUnsafeFuncRule: Rule = {
  id: 'a49d73c26d6511edab16fa163e0fa374',
  name: '不安全函数',
  severity: 'warning',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(GENERAL_UNSAFE_RE);
      if (m) {
        results.push({ ruleId: this.id, line: i, col: m.index ?? 0, message: `不安全函数: '${m[1]}' 是不安全函数，请使用对应的安全版本` });
      }
    });
    return results;
  }
};
