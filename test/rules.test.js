const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const OUT_PREFIX = path.resolve(__dirname, '..', 'out');

function withVscodeStub(config, run) {
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === 'vscode') {
      return {
        workspace: {
          getConfiguration: () => ({
            get: (key, fallback) => Object.prototype.hasOwnProperty.call(config, key) ? config[key] : fallback,
          }),
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };

  for (const cacheKey of Object.keys(require.cache)) {
    if (cacheKey.startsWith(OUT_PREFIX)) {
      delete require.cache[cacheKey];
    }
  }

  try {
    return run();
  } finally {
    Module._load = originalLoad;
  }
}

test('file metrics detect multiline functions inside namespaces', () => {
  withVscodeStub(
    {
      maxFunctionLines: 5,
      maxCyclomaticComplexity: 3,
      maxNestingDepth: 4,
    },
    () => {
      const {
        oversizedFunctionRule,
        oversizedComplexityRule,
        oversizedNestingRule,
      } = require('../out/rules/category/fileMetrics');

      const source = `namespace demo {\nstatic int helper(\n    int value,\n    int limit) {\n  if (value > 0) {\n    for (int i = 0; i < limit; ++i) {\n      if (i % 2 == 0) {\n        while (value > i) {\n          value--;\n        }\n      }\n    }\n  }\n  return value;\n}\n} // namespace demo\n`;

      const functionMatches = oversizedFunctionRule.check(source, 'demo.cpp');
      const complexityMatches = oversizedComplexityRule.check(source, 'demo.cpp');
      const nestingMatches = oversizedNestingRule.check(source, 'demo.cpp');

      assert.equal(functionMatches.length, 1);
      assert.equal(complexityMatches.length, 1);
      assert.equal(nestingMatches.length, 1);
      assert.equal(functionMatches[0].line, 1);
      assert.equal(complexityMatches[0].line, 1);
      assert.equal(nestingMatches[0].line, 1);
    }
  );
});

test('duplicate code collapses overlapping windows into one issue', () => {
  withVscodeStub({}, () => {
    const { duplicateCodeRule } = require('../out/rules/category/duplicates');
    const block = [
      '  int total = seed;',
      '  total += 1;',
      '  total += 2;',
      '  total += 3;',
      '  total += 4;',
      '  total += 5;',
      '  total += 6;',
      '  total += 7;',
      '  total += 8;',
      '  total += 9;',
      '  total += 10;',
      '  return total;',
    ].join('\n');

    const source = `int first(int seed) {\n${block}\n}\n\nint second(int seed) {\n${block}\n}\n`;
    const matches = duplicateCodeRule.check(source, 'dup.cpp');

    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /代码重复/);
  });
});

test('assert runtime rule flags assert but ignores static_assert', () => {
  withVscodeStub({}, () => {
    const { assertRuntimeRule } = require('../out/rules/category/control');
    const source = `#include <cassert>\nvoid check(int value) {\n  static_assert(sizeof(int) == 4);\n  assert(value > 0);\n}\n`;
    const matches = assertRuntimeRule.check(source, 'check.cpp');

    assert.equal(matches.length, 1);
    assert.equal(matches[0].line, 3);
  });
});
