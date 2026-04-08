import { Rule, RuleMatch } from '../types';
import { getLines } from '../../utils/tokenizer';
import * as vscode from 'vscode';

function getLicenseHeader(): string {
  return vscode.workspace
    .getConfiguration('cppChecker')
    .get<string>(
      'licenseHeader',
      '// Copyright (c) Huawei Technologies Co., Ltd. All rights reserved.'
    );
}

export const licenseHeaderRule: Rule = {
  id: '1c7022186d6511edab16fa163e0fa374',
  name: 'OAT.3 许可证头',
  severity: 'fatal',
  check(source: string, filePath: string): RuleMatch[] {
    const lines = getLines(source);
    const firstLine = lines[0]?.trim() ?? '';
    if (!firstLine.startsWith('// Copyright') && !firstLine.startsWith('/*') ) {
      const header = `${getLicenseHeader()}\n// Licensed under the MIT License.\n\n`;
      return [{
        ruleId: this.id,
        line: 0, col: 0,
        message: 'OAT.3: 文件缺少许可证头',
        fix: {
          label: '插入许可证头',
          edits: [
            {
              newText: header,
              range: { line: 0, col: 0, endLine: 0, endCol: 0 }
            }
          ]
        }
      }];
    }
    return [];
  }
};

export const binaryFileRule: Rule = {
  id: '1b147f6d6d6511edab16fa163e0fa374',
  name: 'OAT.1 二进制文件',
  severity: 'error',
  check(source: string, filePath: string): RuleMatch[] {
    // Check for null bytes
    if (source.includes('\0')) {
      return [{
        ruleId: this.id,
        line: 0, col: 0,
        message: 'OAT.1: 检测到二进制文件内容，禁止在代码仓库中提交二进制文件'
      }];
    }
    return [];
  }
};
