import * as vscode from 'vscode';
import { RuleEngine } from './ruleEngine';
import { FixEdit, RuleMatch } from './rules/types';
import { Scanner } from './scanner';
import { getLines, lineColToOffset } from './utils/tokenizer';

interface AppliedFixResult {
  appliedCount: number;
  updatedSource: string;
}

interface NormalizedEdit extends FixEdit {
  start: number;
  end: number;
}

function normalizeDiagnosticCode(code: vscode.Diagnostic['code']): string | undefined {
  if (typeof code === 'string') {
    return code;
  }
  if (typeof code === 'number') {
    return String(code);
  }
  if (code && typeof code === 'object' && 'value' in code) {
    return String(code.value);
  }
  return undefined;
}

function getFullDocumentRange(source: string): vscode.Range {
  const lines = getLines(source);
  const endLine = Math.max(lines.length - 1, 0);
  const endCol = lines[endLine]?.length ?? 0;
  return new vscode.Range(0, 0, endLine, endCol);
}

function collectFixEdits(matches: RuleMatch[]): FixEdit[] {
  return matches.flatMap(match => match.fix?.edits ?? []);
}

function applyEditsToSource(source: string, edits: FixEdit[]): AppliedFixResult {
  const normalizedEdits = edits
    .map<NormalizedEdit>(edit => ({
      ...edit,
      start: lineColToOffset(source, edit.range.line, edit.range.col),
      end: lineColToOffset(source, edit.range.endLine, edit.range.endCol),
    }))
    .sort((a, b) => b.start - a.start || b.end - a.end);

  const acceptedRanges: Array<{ start: number; end: number }> = [];
  let updatedSource = source;
  let appliedCount = 0;

  for (const edit of normalizedEdits) {
    const overlaps = acceptedRanges.some(range => !(edit.end <= range.start || edit.start >= range.end));
    if (overlaps) {
      continue;
    }
    updatedSource = `${updatedSource.slice(0, edit.start)}${edit.newText}${updatedSource.slice(edit.end)}`;
    acceptedRanges.push({ start: edit.start, end: edit.end });
    appliedCount++;
  }

  return { appliedCount, updatedSource };
}

function createWorkspaceEdit(documentUri: vscode.Uri, source: string, updatedSource: string): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(documentUri, getFullDocumentRange(source), updatedSource);
  return edit;
}

export class FixProvider implements vscode.CodeActionProvider {
  private engine: RuleEngine;

  constructor(engine: RuleEngine) {
    this.engine = engine;
  }

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const source = document.getText();
    const matches = this.engine.run(source, document.fileName);

    for (const diag of context.diagnostics) {
      if (diag.source !== 'C++ Checker') continue;
      const diagnosticCode = normalizeDiagnosticCode(diag.code);
      if (!diagnosticCode) continue;

      const match = matches.find(candidate =>
        candidate.ruleId === diagnosticCode &&
        candidate.line === diag.range.start.line &&
        candidate.col === diag.range.start.character &&
        candidate.fix !== undefined
      );

      if (!match?.fix) {
        continue;
      }

      const action = new vscode.CodeAction(match.fix.label, vscode.CodeActionKind.QuickFix);
      action.diagnostics = [diag];
      const edit = new vscode.WorkspaceEdit();
      for (const fixEdit of match.fix.edits) {
        edit.replace(
          document.uri,
          new vscode.Range(
            fixEdit.range.line,
            fixEdit.range.col,
            fixEdit.range.endLine,
            fixEdit.range.endCol
          ),
          fixEdit.newText
        );
      }
      action.edit = edit;
      action.isPreferred = true;
      actions.push(action);
    }

    return actions;
  }
}

export async function fixAllInFile(
  document: vscode.TextDocument,
  engine: RuleEngine
): Promise<number> {
  const source = document.getText();
  const matches = engine.run(source, document.fileName);
  const edits = collectFixEdits(matches.filter(match => match.fix !== undefined));

  if (edits.length === 0) {
    vscode.window.showInformationMessage('当前文件没有可自动修复的问题');
    return 0;
  }

  const { appliedCount, updatedSource } = applyEditsToSource(source, edits);
  if (updatedSource === source || appliedCount === 0) {
    vscode.window.showInformationMessage('当前文件没有可安全应用的自动修复');
    return 0;
  }

  const edit = createWorkspaceEdit(document.uri, source, updatedSource);
  await vscode.workspace.applyEdit(edit);
  vscode.window.showInformationMessage(`已在当前文件应用 ${appliedCount} 处自动修复`);
  return appliedCount;
}

export async function fixAllInWorkspace(
  scanner: Scanner,
  engine: RuleEngine
): Promise<{ files: number; fixes: number }> {
  const files = await scanner.findCppFiles();
  const edit = new vscode.WorkspaceEdit();
  let fixedFiles = 0;
  let totalFixes = 0;

  for (const uri of files) {
    const document = await vscode.workspace.openTextDocument(uri);
    const source = document.getText();
    const matches = engine.run(source, document.fileName);
    const edits = collectFixEdits(matches.filter(match => match.fix !== undefined));
    if (edits.length === 0) {
      continue;
    }

    const { appliedCount, updatedSource } = applyEditsToSource(source, edits);
    if (updatedSource === source || appliedCount === 0) {
      continue;
    }

    edit.replace(uri, getFullDocumentRange(source), updatedSource);
    fixedFiles++;
    totalFixes += appliedCount;
  }

  if (fixedFiles === 0) {
    vscode.window.showInformationMessage('工作区内没有可自动修复的问题');
    return { files: 0, fixes: 0 };
  }

  await vscode.workspace.applyEdit(edit);
  vscode.window.showInformationMessage(`已在 ${fixedFiles} 个文件中应用 ${totalFixes} 处自动修复`);
  return { files: fixedFiles, fixes: totalFixes };
}
