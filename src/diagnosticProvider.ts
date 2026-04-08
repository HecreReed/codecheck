import * as vscode from 'vscode';
import { RuleMatch } from './rules/types';
import { RuleCatalog } from './ruleCatalog';

const SEVERITY_MAP: Record<string, vscode.DiagnosticSeverity> = {
  fatal: vscode.DiagnosticSeverity.Error,
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

export class DiagnosticProvider {
  private collection: vscode.DiagnosticCollection;
  private catalog: RuleCatalog;

  constructor(collection: vscode.DiagnosticCollection, catalog: RuleCatalog) {
    this.collection = collection;
    this.catalog = catalog;
  }

  update(filePath: string, matches: RuleMatch[]): void {
    const uri = vscode.Uri.file(filePath);
    const diagnostics = matches.map(m => {
      const severity = this.catalog.getSeverity(m.ruleId) ?? 'warning';
      const range = new vscode.Range(
        m.line, m.col,
        m.endLine ?? m.line, m.endCol ?? 1000
      );
      const diag = new vscode.Diagnostic(range, m.message, SEVERITY_MAP[severity]);
      diag.source = 'C++ Checker';
      diag.code = m.ruleId;
      return diag;
    });
    this.collection.set(uri, diagnostics);
  }

  clear(filePath?: string): void {
    if (filePath) {
      this.collection.set(vscode.Uri.file(filePath), []);
    } else {
      this.collection.clear();
    }
  }
}
