import { RULESET_SNAPSHOT } from './generated/rulesetSnapshot';
import { Rule, Severity } from './rules/types';

interface RuleCatalogEntry {
  id: string;
  name: string;
  severity: Severity;
}

export class RuleCatalog {
  private entryById = new Map<string, RuleCatalogEntry>();
  private implementedIds = new Set<string>();

  constructor(rules: Rule[]) {
    this.loadSnapshot();
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

  private loadSnapshot(): void {
    for (const [id, name, severity] of RULESET_SNAPSHOT) {
      this.entryById.set(id, { id, name, severity });
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
}
