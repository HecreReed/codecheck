import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { fileURLToPath } from 'url';
import { runTests } from '@vscode/test-electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '..');
  const extensionTestsPath = path.resolve(__dirname, 'extension-runner.js');
  const workspaceTemplatePath = path.resolve(__dirname, 'fixtures', 'workspace');
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), 'cpp-checker-smoke-'));

  await fs.cp(workspaceTemplatePath, workspacePath, { recursive: true });

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspacePath, '--disable-extensions'],
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
