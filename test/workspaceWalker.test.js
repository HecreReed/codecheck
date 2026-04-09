const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const {
  collectCppFilesFromDirectory,
  DEFAULT_EXCLUDED_DIRECTORY_PATTERNS,
  shouldExcludeDirectory,
} = require('../out/utils/workspaceWalker');

test('shouldExcludeDirectory matches exact names and simple prefixes', () => {
  assert.equal(shouldExcludeDirectory('build', DEFAULT_EXCLUDED_DIRECTORY_PATTERNS), true);
  assert.equal(shouldExcludeDirectory('build-debug', DEFAULT_EXCLUDED_DIRECTORY_PATTERNS), true);
  assert.equal(shouldExcludeDirectory('cmake-build-release', DEFAULT_EXCLUDED_DIRECTORY_PATTERNS), true);
  assert.equal(shouldExcludeDirectory('src', DEFAULT_EXCLUDED_DIRECTORY_PATTERNS), false);
});

test('collectCppFilesFromDirectory skips generated directories but keeps source trees', async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cpp-checker-walker-'));

  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'include', 'module'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'build-debug'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'tmp'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'install', 'include'), { recursive: true });

  await fs.writeFile(path.join(workspaceRoot, 'src', 'main.cpp'), 'int main() { return 0; }\n');
  await fs.writeFile(path.join(workspaceRoot, 'include', 'module', 'api.hpp'), '#pragma once\n');
  await fs.writeFile(path.join(workspaceRoot, 'build-debug', 'generated.cpp'), 'int generated() { return 1; }\n');
  await fs.writeFile(path.join(workspaceRoot, 'tmp', 'scratch.cpp'), 'int scratch() { return 2; }\n');
  await fs.writeFile(path.join(workspaceRoot, 'install', 'include', 'generated.h'), '#pragma once\n');

  const discoveredFiles = await collectCppFilesFromDirectory(workspaceRoot, DEFAULT_EXCLUDED_DIRECTORY_PATTERNS);
  const relativeFiles = discoveredFiles.map(filePath => path.relative(workspaceRoot, filePath));

  assert.deepEqual(relativeFiles, [
    path.join('include', 'module', 'api.hpp'),
    path.join('src', 'main.cpp'),
  ]);
});
