import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { Rule, Severity } from './rules/types';

interface RuleCatalogEntry {
  id: string;
  language: string;
  name: string;
  severity: Severity;
}

const EXCEL_SEVERITY_MAP: Record<string, Severity> = {
  '致命': 'fatal',
  '严重': 'error',
  '一般': 'warning',
  '建议': 'info',
};

export class RuleCatalog {
  private entryById = new Map<string, RuleCatalogEntry>();
  private implementedIds = new Set<string>();

  constructor(extensionPath: string, rules: Rule[]) {
    this.loadWorkbook(extensionPath);
    this.registerImplementedRules(rules);
  }

  getSeverity(ruleId: string): Severity | undefined {
    return this.entryById.get(ruleId)?.severity;
  }

  getName(ruleId: string): string | undefined {
    return this.entryById.get(ruleId)?.name;
  }

  getCoverage(): { total: number; implemented: number; missing: RuleCatalogEntry[] } {
    const missing = [...this.entryById.values()].filter(entry => !this.implementedIds.has(entry.id));
    return {
      total: this.entryById.size,
      implemented: this.entryById.size - missing.length,
      missing,
    };
  }

  private loadWorkbook(extensionPath: string): void {
    const workbookName = this.getWorkbookName(extensionPath);
    if (!workbookName) {
      return;
    }

    const workbookPath = path.join(extensionPath, workbookName);
    const workbook = XLSX.readFile(workbookPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | undefined)[]>(sheet, {
      header: 1,
      raw: false,
    });

    for (const row of rows.slice(1)) {
      const [name, severityLabel, id, language] = row;
      if (!id || !severityLabel || !name) {
        continue;
      }

      const severity = EXCEL_SEVERITY_MAP[severityLabel];
      if (!severity) {
        continue;
      }

      this.entryById.set(id, {
        id,
        language: language ?? '',
        name,
        severity,
      });
    }
  }

  private registerImplementedRules(rules: Rule[]): void {
    for (const rule of rules) {
      this.implementedIds.add(rule.id);
      for (const alias of rule.aliases ?? []) {
        this.implementedIds.add(alias);
      }
    }
  }

  private getWorkbookName(extensionPath: string): string | undefined {
    const configuredName = process.env.CPP_CHECKER_RULESET;
    if (configuredName && fs.existsSync(path.join(extensionPath, configuredName))) {
      return configuredName;
    }

    return fs.readdirSync(extensionPath)
      .find(fileName => /^mr_ruleset_.*\.xlsx$/i.test(fileName));
  }
}
