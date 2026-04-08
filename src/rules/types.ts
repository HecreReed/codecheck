export type Severity = 'fatal' | 'error' | 'warning' | 'info';

export interface FixEdit {
  newText: string;
  range: { line: number; col: number; endLine: number; endCol: number };
}

export interface Fix {
  label: string;
  edits: FixEdit[];
}

export interface RuleMatch {
  ruleId: string;
  line: number; // 0-based
  col: number;
  endLine?: number;
  endCol?: number;
  message: string;
  fix?: Fix;
}

export interface Rule {
  id: string;
  name: string;
  severity: Severity;
  aliases?: string[];
  check(source: string, filePath: string): RuleMatch[];
}
