import { Rule, RuleMatch } from '../types';
import { tokenize, getLines } from '../../utils/tokenizer';

const CPP_KEYWORDS = new Set([
  'alignas','alignof','and','and_eq','asm','auto','bitand','bitor','bool','break',
  'case','catch','char','char8_t','char16_t','char32_t','class','compl','concept',
  'const','consteval','constexpr','constinit','const_cast','continue','co_await',
  'co_return','co_yield','decltype','default','delete','do','double','dynamic_cast',
  'else','enum','explicit','export','extern','false','float','for','friend','goto',
  'if','inline','int','long','mutable','namespace','new','noexcept','not','not_eq',
  'nullptr','operator','or','or_eq','private','protected','public','register',
  'reinterpret_cast','requires','return','short','signed','sizeof','static',
  'static_assert','static_cast','struct','switch','template','this','thread_local',
  'throw','true','try','typedef','typeid','typename','union','unsigned','using',
  'virtual','void','volatile','wchar_t','while','xor','xor_eq'
]);

// G.PRE.07: macro name same as keyword
export const macroKeywordRule: Rule = {
  id: '033d0c6f6d6511edab16fa163e0fa374',
  name: 'G.PRE.07 宏的名称不应与关键字相同',
  severity: 'error',
  aliases: ['7df4f2436d6511edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      const m = line.match(/^\s*#\s*define\s+(\w+)/);
      if (m && CPP_KEYWORDS.has(m[1])) {
        results.push({
          ruleId: this.id, line: i, col: line.indexOf(m[1]),
          message: `G.PRE.07: 宏名称 '${m[1]}' 与C++关键字相同`
        });
      }
    });
    return results;
  }
};

// G.PRE.05-CPP: #else/#elif/#endif must be in same file as matching #if
export const preprocessorPairingRule: Rule = {
  id: '0242eb776d6511edab16fa163e0fa374',
  name: 'G.PRE.05-CPP #else/#elif/#endif与对应#if在同一文件',
  severity: 'error',
  aliases: ['7f41cee96d6511edab16fa163e0fa374'],
  check(source: string): RuleMatch[] {
    const lines = getLines(source);
    const results: RuleMatch[] = [];
    let depth = 0;
    const stack: number[] = [];
    lines.forEach((line, i) => {
      const t = line.trim();
      if (/^#\s*(if|ifdef|ifndef)\b/.test(t)) { stack.push(i); depth++; }
      else if (/^#\s*endif\b/.test(t)) {
        if (stack.length === 0) {
          results.push({ ruleId: this.id, line: i, col: 0, message: 'G.PRE.05-CPP: #endif 没有对应的 #if/#ifdef/#ifndef' });
        } else { stack.pop(); depth--; }
      }
    });
    stack.forEach(lineNum => {
      results.push({ ruleId: this.id, line: lineNum, col: 0, message: 'G.PRE.05-CPP: #if/#ifdef/#ifndef 没有对应的 #endif' });
    });
    return results;
  }
};

// G.INC.08-CPP: no 'using namespace' before #include
export const usingBeforeIncludeRule: Rule = {
  id: '0e93c2b36d6511edab16fa163e0fa374',
  name: 'G.INC.08-CPP 不要在#include之前使用using导入namespace',
  severity: 'error',
  check(source: string): RuleMatch[] {
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    let lastIncludeLine = -1;
    // find last #include line
    lines.forEach((line, i) => { if (/^\s*#\s*include\b/.test(line)) lastIncludeLine = i; });
    lines.forEach((line, i) => {
      if (i < lastIncludeLine && /^\s*using\s+namespace\b/.test(line)) {
        const col = line.search(/using/);
        const moveTargetLine = lastIncludeLine + 1;
        results.push({
          ruleId: this.id, line: i, col,
          message: 'G.INC.08-CPP: 不要在 #include 之前使用 using namespace',
          fix: {
            label: '移动 using namespace 到 #include 之后',
            edits: [
              {
                newText: '',
                range: { line: i, col: 0, endLine: i + 1, endCol: 0 }
              },
              {
                newText: `${line.trim()}\n`,
                range: { line: moveTargetLine, col: 0, endLine: moveTargetLine, endCol: 0 }
              }
            ]
          }
        });
      }
    });
    return results;
  }
};

// G.INC.05-CPP: no #include inside extern "C"
export const includeInExternCRule: Rule = {
  id: '0d9a91896d6511edab16fa163e0fa374',
  name: 'G.INC.05-CPP 禁止在extern "C"中包含头文件',
  severity: 'error',
  check(source: string): RuleMatch[] {
    const lines = getLines(source);
    const results: RuleMatch[] = [];
    let inExternC = false;
    let depth = 0;
    let externDepth = -1;
    lines.forEach((line, i) => {
      if (/extern\s+"C"\s*\{/.test(line)) { inExternC = true; externDepth = depth; depth++; }
      else if (inExternC) {
        for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
        if (depth <= externDepth) { inExternC = false; externDepth = -1; }
        if (inExternC && /^\s*#\s*include\b/.test(line)) {
          results.push({ ruleId: this.id, line: i, col: 0, message: 'G.INC.05-CPP: 禁止在 extern "C" 块中使用 #include' });
        }
      } else {
        for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      }
    });
    return results;
  }
};

// G.INC.07 / G.EXP.05-CPP: extern function/variable declarations (not in headers)
export const externDeclarationRule: Rule = {
  id: '110c809b6d6511edab16fa163e0fa374',
  name: 'G.EXP.05-CPP 禁止通过声明的方式引用外部函数接口和变量',
  severity: 'error',
  aliases: ['77fbc54e6d6511edab16fa163e0fa374'],
  check(source: string, filePath: string): RuleMatch[] {
    if (filePath.endsWith('.h') || filePath.endsWith('.hpp')) return [];
    const { cleaned } = tokenize(source);
    const lines = getLines(cleaned);
    const results: RuleMatch[] = [];
    lines.forEach((line, i) => {
      if (/^\s*extern\b(?!\s*"C")/.test(line) && !/^\s*extern\s+"C"/.test(line)) {
        results.push({ ruleId: this.id, line: i, col: 0, message: 'G.EXP.05-CPP: 禁止通过 extern 声明方式引用外部函数或变量，应通过头文件引用' });
      }
    });
    return results;
  }
};
