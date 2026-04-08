import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { RuleMatch, Severity } from './rules/types';
import { RuleCatalog } from './ruleCatalog';

export class WorkspaceIssueFileItem extends vscode.TreeItem {
  readonly filePath: string;
  readonly resourceUri: vscode.Uri;
  readonly contextValue = 'cppCheckerFile';
  readonly matches: RuleMatch[];

  constructor(filePath: string, matches: RuleMatch[], highestSeverity: Severity) {
    super(path.basename(filePath), vscode.TreeItemCollapsibleState.Expanded);
    this.filePath = filePath;
    this.resourceUri = vscode.Uri.file(filePath);
    this.matches = matches;
    this.description = `${matches.length} 个问题`;
    this.tooltip = filePath;
    this.iconPath = new vscode.ThemeIcon(getSeverityIcon(highestSeverity));
    this.command = {
      command: 'vscode.open',
      title: '打开文件',
      arguments: [this.resourceUri],
    };
  }
}

export class WorkspaceIssueMatchItem extends vscode.TreeItem {
  readonly filePath: string;
  readonly resourceUri: vscode.Uri;
  readonly contextValue = 'cppCheckerIssue';
  readonly match: RuleMatch;

  constructor(filePath: string, match: RuleMatch, severity: Severity, ruleName: string | undefined, snippet: string) {
    super(`L${match.line + 1}: ${match.message}`, vscode.TreeItemCollapsibleState.None);
    this.filePath = filePath;
    this.resourceUri = vscode.Uri.file(filePath);
    this.match = match;
    this.description = snippet;
    this.tooltip = `${ruleName ?? match.ruleId}\n${match.message}\n${filePath}:${match.line + 1}`;
    this.iconPath = new vscode.ThemeIcon(getSeverityIcon(severity));
    this.command = {
      command: 'cppChecker.openIssue',
      title: '打开问题位置',
      arguments: [this],
    };
  }
}

export class WorkspaceIssuesProvider implements vscode.TreeDataProvider<WorkspaceIssueFileItem | WorkspaceIssueMatchItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<WorkspaceIssueFileItem | WorkspaceIssueMatchItem | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private readonly results = new Map<string, RuleMatch[]>();
  private view?: vscode.TreeView<WorkspaceIssueFileItem | WorkspaceIssueMatchItem>;
  private fileSnippetCache = new Map<string, string[]>();

  constructor(private readonly catalog: RuleCatalog) {}

  attachView(view: vscode.TreeView<WorkspaceIssueFileItem | WorkspaceIssueMatchItem>): void {
    this.view = view;
    this.refreshViewMessage();
  }

  replaceAll(results: Map<string, RuleMatch[]>): void {
    this.results.clear();
    this.fileSnippetCache.clear();
    for (const [filePath, matches] of results) {
      if (matches.length > 0) {
        this.results.set(filePath, [...matches]);
      }
    }
    this.refresh();
  }

  updateFile(filePath: string, matches: RuleMatch[]): void {
    this.fileSnippetCache.delete(filePath);
    if (matches.length === 0) {
      this.results.delete(filePath);
    } else {
      this.results.set(filePath, [...matches]);
    }
    this.refresh();
  }

  clear(filePath?: string): void {
    if (filePath) {
      this.results.delete(filePath);
      this.fileSnippetCache.delete(filePath);
    } else {
      this.results.clear();
      this.fileSnippetCache.clear();
    }
    this.refresh();
  }

  getTreeItem(element: WorkspaceIssueFileItem | WorkspaceIssueMatchItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: WorkspaceIssueFileItem | WorkspaceIssueMatchItem): Thenable<Array<WorkspaceIssueFileItem | WorkspaceIssueMatchItem>> {
    if (!element) {
      const items = [...this.results.entries()]
        .sort((a, b) => {
          const issueCountDiff = b[1].length - a[1].length;
          if (issueCountDiff !== 0) {
            return issueCountDiff;
          }
          return a[0].localeCompare(b[0]);
        })
        .map(([filePath, matches]) => {
          const severities = matches.map(match => this.catalog.getSeverity(match.ruleId) ?? 'warning');
          const highestSeverity = severities.sort(compareSeverity)[0] ?? 'warning';
          return new WorkspaceIssueFileItem(filePath, matches, highestSeverity);
        });
      return Promise.resolve(items);
    }

    if (element instanceof WorkspaceIssueFileItem) {
      const lines = this.getFileLines(element.filePath);
      const children = element.matches.map(match => {
        const severity = this.catalog.getSeverity(match.ruleId) ?? 'warning';
        const ruleName = this.catalog.getName(match.ruleId);
        const snippet = lines[match.line]?.trim() ?? '';
        return new WorkspaceIssueMatchItem(element.filePath, match, severity, ruleName, snippet);
      });
      return Promise.resolve(children);
    }

    return Promise.resolve([]);
  }

  private refresh(): void {
    this.refreshViewMessage();
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  private refreshViewMessage(): void {
    if (!this.view) {
      return;
    }
    const totalFiles = this.results.size;
    const totalIssues = [...this.results.values()].reduce((sum, matches) => sum + matches.length, 0);
    this.view.message = totalFiles === 0
      ? '暂无问题。运行 Scan Workspace 开始检查。'
      : `${totalFiles} 个文件，${totalIssues} 个问题`;
  }

  private getFileLines(filePath: string): string[] {
    const cached = this.fileSnippetCache.get(filePath);
    if (cached) {
      return cached;
    }
    try {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      this.fileSnippetCache.set(filePath, lines);
      return lines;
    } catch {
      return [];
    }
  }
}

function getSeverityIcon(severity: Severity): string {
  switch (severity) {
    case 'fatal':
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

function compareSeverity(left: Severity, right: Severity): number {
  const rank: Record<Severity, number> = {
    fatal: 0,
    error: 1,
    warning: 2,
    info: 3,
  };
  return rank[left] - rank[right];
}
