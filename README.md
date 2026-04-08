# C++ Code Checker

一个 VS Code 插件项目，用来根据仓库内的 `mr_ruleset_*.xlsx` 规则表扫描当前工作区中的 C/C++ 文件，输出诊断信息，并对可安全自动修复的问题提供一键修复能力。

## 当前能力

- 启动后自动扫描当前工作区中的 `.cpp/.cc/.cxx/.c/.h/.hpp` 文件
- 支持手动执行工作区扫描
- 支持当前文件一键修复
- 支持工作区一键修复
- 规则覆盖对齐当前仓库中的 Excel 规则表
- 增加了工作区级规则：
  - 重复文件
  - 超大目录

## 已实现的关键规则增强

- `G.FUU.12`：拆分为 `destMax/count` 检查和 `destMax` 正确性检查
- `G.STD.13-CPP`：增加格式化类型不匹配检查
- `G.FUU.15`：增加用户自定义安全函数检测
- `超大函数 / 超大深度函数 / 超大圈复杂度`：拆分为独立规则 ID
- 为 Excel 中的 C/C++ 双份规则 ID 增加了别名映射

## 命令

- `C++ Checker: Scan Workspace`
- `C++ Checker: Fix All Auto-fixable Issues in Current File`
- `C++ Checker: Fix All Auto-fixable Issues in Workspace`

## 配置项

- `cppChecker.autoScanWorkspaceOnActivate`
- `cppChecker.autoScanWorkspaceOnSave`
- `cppChecker.maxHeaderLines`
- `cppChecker.maxSourceLines`
- `cppChecker.maxFunctionLines`
- `cppChecker.maxNestingDepth`
- `cppChecker.maxCyclomaticComplexity`
- `cppChecker.maxFilesPerDirectory`
- `cppChecker.licenseHeader`

## 本地开发

```bash
npm install
npm run compile
```

按 `F5` 启动 VS Code Extension Development Host 进行调试。
