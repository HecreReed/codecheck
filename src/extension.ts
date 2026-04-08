import * as vscode from 'vscode';
import { RuleEngine } from './ruleEngine';
import { Scanner } from './scanner';
import { DiagnosticProvider } from './diagnosticProvider';
import { FixProvider, fixAllInFile, fixAllInWorkspace } from './fixProvider';
import { RuleCatalog } from './ruleCatalog';

let diagnosticProvider: DiagnosticProvider;
let scanner: Scanner;
let engine: RuleEngine;
let catalog: RuleCatalog;

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('cppChecker');
  return {
    autoScanWorkspaceOnActivate: cfg.get<boolean>('autoScanWorkspaceOnActivate', true),
    autoScanWorkspaceOnSave: cfg.get<boolean>('autoScanWorkspaceOnSave', true),
  };
}

async function refreshWorkspaceDiagnostics(showNotification = false): Promise<void> {
  diagnosticProvider.clear();
  const runScan = async () => {
    const results = await scanner.scanAll();
    let total = 0;
    for (const [filePath, matches] of results) {
      diagnosticProvider.update(filePath, matches);
      total += matches.length;
    }
    if (showNotification) {
      vscode.window.showInformationMessage(`扫描完成，共发现 ${total} 个问题，涉及 ${results.size} 个文件`);
    }
  };

  if (showNotification) {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: '正在扫描C/C++ 工作区...', cancellable: false },
      runScan
    );
    return;
  }

  await runScan();
}

export function activate(context: vscode.ExtensionContext) {
  engine = new RuleEngine();
  catalog = new RuleCatalog(context.extensionPath, engine.getRules());
  scanner = new Scanner(engine);

  const collection = vscode.languages.createDiagnosticCollection('cpp-checker');
  diagnosticProvider = new DiagnosticProvider(collection, catalog);
  context.subscriptions.push(collection);

  const coverage = catalog.getCoverage();
  if (coverage.missing.length > 0) {
    const preview = coverage.missing.slice(0, 3).map(entry => entry.name).join('、');
    vscode.window.showWarningMessage(`当前规则集仍有 ${coverage.missing.length} 条 Excel 规则未实现：${preview}${coverage.missing.length > 3 ? ' 等' : ''}`);
  }

  const fixProvider = new FixProvider(engine);
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [{ language: 'cpp' }, { language: 'c' }],
      fixProvider,
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cppChecker.scanWorkspace', async () => {
      await refreshWorkspaceDiagnostics(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cppChecker.fixAll', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('请先打开一个 C/C++ 文件');
        return;
      }
      await fixAllInFile(editor.document, engine);
      await refreshWorkspaceDiagnostics(false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cppChecker.fixWorkspace', async () => {
      await fixAllInWorkspace(scanner, engine);
      await refreshWorkspaceDiagnostics(false);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async doc => {
      if (isCppFile(doc.fileName) && !getConfig().autoScanWorkspaceOnActivate) {
        const matches = scanner.scanFile(doc.fileName);
        diagnosticProvider.update(doc.fileName, matches);
      }
    })
  );

  let debounceTimer: NodeJS.Timeout | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (!isCppFile(doc.fileName)) {
        return;
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        if (getConfig().autoScanWorkspaceOnSave) {
          await refreshWorkspaceDiagnostics(false);
          return;
        }
        const matches = scanner.scanFile(doc.fileName);
        diagnosticProvider.update(doc.fileName, matches);
      }, 300);
    })
  );

  if (getConfig().autoScanWorkspaceOnActivate) {
    void refreshWorkspaceDiagnostics(false);
  } else {
    for (const doc of vscode.workspace.textDocuments) {
      if (isCppFile(doc.fileName)) {
        const matches = scanner.scanFile(doc.fileName);
        diagnosticProvider.update(doc.fileName, matches);
      }
    }
  }
}

function isCppFile(fileName: string): boolean {
  return /\.(cpp|h|hpp|cc|cxx|c)$/.test(fileName);
}

export function deactivate() {}
