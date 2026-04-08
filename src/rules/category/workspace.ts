import { Rule } from '../types';

export const duplicateFileRule: Rule = {
  id: 'a156d1806d6511edab16fa163e0fa374',
  name: '重复文件',
  severity: 'warning',
  check(): [] {
    return [];
  }
};

export const oversizedDirectoryRule: Rule = {
  id: 'a2fb71d96d6511edab16fa163e0fa374',
  name: '超大目录',
  severity: 'warning',
  check(): [] {
    return [];
  }
};
