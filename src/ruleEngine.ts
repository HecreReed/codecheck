import { Rule, RuleMatch } from './rules/types';
import { ALL_RULES } from './rules/index';

export class RuleEngine {
  private rules: Rule[];

  constructor(rules: Rule[] = ALL_RULES) {
    this.rules = rules;
  }

  run(source: string, filePath: string): RuleMatch[] {
    const results: RuleMatch[] = [];
    for (const rule of this.rules) {
      try {
        results.push(...rule.check(source, filePath));
      } catch (e) {
        // Don't let one rule crash the whole engine
      }
    }
    return results;
  }

  getRules(): Rule[] {
    return [...this.rules];
  }
}
