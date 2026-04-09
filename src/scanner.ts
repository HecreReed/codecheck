import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RuleEngine } from './ruleEngine';
import { RuleMatch } from './rules/types';
import { hashContent } from './utils/fileUtils';
import { collectCppFilesFromDirectory, DEFAULT_EXCLUDED_DIRECTORY_PATTERNS, isExcludedPath } from './utils/workspaceWalker';

const CPP_GLOB = '**/*.{cpp,h,hpp,cc,cxx,c}';

function getWorkspaceConfig() {
  const cfg = vscode.workspace.getConfiguration('cppChecker');
  return {
    maxFilesPerDirectory: cfg.get<number>('maxFilesPerDirectory', 50),
    excludeDirectories: cfg.get<string[]>('excludeDirectories', DEFAULT_EXCLUDED_DIRECTORY_PATTERNS),
  };
}

export class Scanner {
  private engine: RuleEngine;

  constructor(engine: RuleEngine) {
    this.engine = engine;
  }

  async scanAll(): Promise<Map<string, RuleMatch[]>> {
    const results = new Map<string, RuleMatch[]>();
    const files = await this.findCppFiles();
    for (const uri of files) {
      const matches = this.scanFile(uri.fsPath);
      results.set(uri.fsPath, matches);
    }

    this.applyWorkspaceRules(results, files.map(uri => uri.fsPath));
    return results;
  }

  scanFile(filePath: string): RuleMatch[] {
    try {
      const source = fs.readFileSync(filePath, 'utf8');
      return this.engine.run(source, filePath);
    } catch {
      return [];
    }
  }

  async findCppFiles(): Promise<vscode.Uri[]> {
    const config = getWorkspaceConfig();
    const discoveredFiles = new Map<string, vscode.Uri>();
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];

    for (const folder of workspaceFolders) {
      if (folder.uri.scheme === 'file') {
        const filePaths = await collectCppFilesFromDirectory(folder.uri.fsPath, config.excludeDirectories);
        for (const filePath of filePaths) {
          discoveredFiles.set(filePath, vscode.Uri.file(filePath));
        }
        continue;
      }

      const uris = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, CPP_GLOB));
      for (const uri of uris) {
        if (!isExcludedPath(uri.path, config.excludeDirectories)) {
          discoveredFiles.set(uri.toString(), uri);
        }
      }
    }

    return [...discoveredFiles.values()].sort((left, right) => left.fsPath.localeCompare(right.fsPath));
  }

  private applyWorkspaceRules(results: Map<string, RuleMatch[]>, filePaths: string[]): void {
    const config = getWorkspaceConfig();
    const duplicateFiles = new Map<string, string[]>();
    const filesByDirectory = new Map<string, string[]>();

    for (const filePath of filePaths) {
      const source = fs.readFileSync(filePath, 'utf8');
      const hash = hashContent(source);
      duplicateFiles.set(hash, [...(duplicateFiles.get(hash) ?? []), filePath]);

      const directory = path.dirname(filePath);
      filesByDirectory.set(directory, [...(filesByDirectory.get(directory) ?? []), filePath]);
    }

    for (const files of duplicateFiles.values()) {
      if (files.length < 2) {
        continue;
      }
      for (const filePath of files) {
        const duplicates = files.filter(candidate => candidate !== filePath).map(candidate => path.basename(candidate));
        this.pushWorkspaceMatch(results, filePath, {
          ruleId: 'a156d1806d6511edab16fa163e0fa374',
          line: 0,
          col: 0,
          message: `重复文件: 当前文件与 ${duplicates.join(', ')} 内容完全一致`
        });
      }
    }

    for (const [directory, files] of filesByDirectory) {
      if (files.length <= config.maxFilesPerDirectory) {
        continue;
      }
      for (const filePath of files) {
        this.pushWorkspaceMatch(results, filePath, {
          ruleId: 'a2fb71d96d6511edab16fa163e0fa374',
          line: 0,
          col: 0,
          message: `超大目录: 目录 '${path.basename(directory)}' 下共有 ${files.length} 个 C/C++ 文件，超过限制 ${config.maxFilesPerDirectory}`
        });
      }
    }
  }

  private pushWorkspaceMatch(results: Map<string, RuleMatch[]>, filePath: string, match: RuleMatch): void {
    const matches = results.get(filePath) ?? [];
    matches.push(match);
    results.set(filePath, matches);
  }
}
