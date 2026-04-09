const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');

const LICENSE_HEADER = '// Copyright (c) Huawei Technologies Co., Ltd. All rights reserved.';
const RULE_LICENSE = '1c7022186d6511edab16fa163e0fa374';
const RULE_USING_BEFORE_INCLUDE = '0e93c2b36d6511edab16fa163e0fa374';
const RULE_WARNING_SUPPRESS = 'a4f056c86d6511edab16fa163e0fa374';
const RULE_DUPLICATE_FILE = 'a156d1806d6511edab16fa163e0fa374';
const RULE_OVERSIZED_DIRECTORY = 'a2fb71d96d6511edab16fa163e0fa374';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs, errorMessage) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await sleep(150);
  }
  throw new Error(errorMessage);
}

async function getWorkspaceFile(relativePath) {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error('Missing workspace folder for smoke test');
  }
  return vscode.Uri.file(path.join(folder.uri.fsPath, relativePath));
}

async function diagnosticsContain(fileUri, ruleId) {
  const diagnostics = vscode.languages.getDiagnostics(fileUri);
  return diagnostics.some(diagnostic => String(diagnostic.code) === ruleId);
}

exports.run = async function run() {
  const commands = await vscode.commands.getCommands(true);
  assert(commands.includes('cppChecker.scanWorkspace'));
  assert(commands.includes('cppChecker.scanFile'));
  assert(commands.includes('cppChecker.fixAll'));
  assert(commands.includes('cppChecker.fixFile'));
  assert(commands.includes('cppChecker.fixWorkspace'));

  await vscode.workspace.getConfiguration('cppChecker').update('autoScanWorkspaceOnActivate', false, vscode.ConfigurationTarget.Workspace);
  await vscode.workspace.getConfiguration('cppChecker').update('autoScanWorkspaceOnSave', false, vscode.ConfigurationTarget.Workspace);
  await vscode.workspace.getConfiguration('cppChecker').update('maxFilesPerDirectory', 2, vscode.ConfigurationTarget.Workspace);

  const mainUri = await getWorkspaceFile('main.cpp');
  const duplicate1Uri = await getWorkspaceFile('duplicate1.cpp');
  const duplicate2Uri = await getWorkspaceFile('duplicate2.cpp');
  const ignoredBuildUri = await getWorkspaceFile(path.join('build-debug', 'generated.cpp'));
  const ignoredTmpUri = await getWorkspaceFile(path.join('tmp', 'scratch.cpp'));
  const ignoredInstallUri = await getWorkspaceFile(path.join('install', 'include', 'generated.h'));

  const mainDocument = await vscode.workspace.openTextDocument(mainUri);
  await vscode.window.showTextDocument(mainDocument);

  await vscode.commands.executeCommand('cppChecker.scanFile', mainUri);
  await waitFor(async () => diagnosticsContain(mainUri, RULE_LICENSE), 15000, 'scanFile did not report missing license header');

  await vscode.commands.executeCommand('cppChecker.scanWorkspace');

  await waitFor(async () => diagnosticsContain(mainUri, RULE_USING_BEFORE_INCLUDE), 15000, 'scanWorkspace did not report using-before-include');
  await waitFor(async () => diagnosticsContain(mainUri, RULE_WARNING_SUPPRESS), 15000, 'scanWorkspace did not report warning suppression');
  await waitFor(async () => diagnosticsContain(duplicate1Uri, RULE_DUPLICATE_FILE), 15000, 'scanWorkspace did not report duplicate files');
  await waitFor(async () => diagnosticsContain(mainUri, RULE_OVERSIZED_DIRECTORY), 15000, 'scanWorkspace did not report oversized directory');
  assert.equal(await diagnosticsContain(ignoredBuildUri, RULE_LICENSE), false, 'scanWorkspace should ignore build-debug/generated.cpp');
  assert.equal(await diagnosticsContain(ignoredTmpUri, RULE_LICENSE), false, 'scanWorkspace should ignore tmp/scratch.cpp');
  assert.equal(await diagnosticsContain(ignoredInstallUri, RULE_LICENSE), false, 'scanWorkspace should ignore install/include/generated.h');

  await vscode.commands.executeCommand('cppChecker.fixFile', mainUri);
  await sleep(1000);

  const updatedMain = (await vscode.workspace.openTextDocument(mainUri)).getText();
  assert(updatedMain.startsWith(LICENSE_HEADER), 'fixAll did not insert the configured license header');
  assert(!updatedMain.includes('#pragma warning(disable:4996)'), 'fixAll did not remove warning suppression');
  assert(updatedMain.indexOf('#include <stdio.h>') < updatedMain.indexOf('using namespace std;'), 'fixAll did not move using namespace below includes');

  await vscode.commands.executeCommand('cppChecker.fixWorkspace');
  await sleep(1500);

  const duplicate1Text = await fs.readFile(duplicate1Uri.fsPath, 'utf8');
  const duplicate2Text = await fs.readFile(duplicate2Uri.fsPath, 'utf8');
  assert(duplicate1Text.startsWith(LICENSE_HEADER), 'fixWorkspace did not update duplicate1.cpp');
  assert(duplicate2Text.startsWith(LICENSE_HEADER), 'fixWorkspace did not update duplicate2.cpp');
};
