# C++ Code Checker

一个 VS Code 插件项目，用来根据内置的规则快照扫描当前工作区中的 C/C++ 文件，输出诊断信息，并对可安全自动修复的问题提供一键修复能力。规则快照来源于原始 Excel 规则表，但最终仓库和 `.vsix` 安装包不再依赖或携带原始 `.xlsx` 文件。

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
npm run test:smoke
npm run package:vsix
```

### 调试运行

1. 用 VS Code 打开这个项目根目录。
2. 首次执行 `npm install`。
3. 直接按 `F5`，选择 `Run Extension`。
4. 会弹出一个新的 `Extension Development Host` 窗口。
5. 在那个新窗口里再打开一个包含 C/C++ 文件的工程或目录。
6. 用命令面板执行下面几个命令：

- `C++ Checker: Scan Workspace`
- `C++ Checker: Scan Current File`
- `C++ Checker: Fix All Auto-fixable Issues in Current File`
- `C++ Checker: Fix Current File`
- `C++ Checker: Fix All Auto-fixable Issues in Workspace`

### 右键与快捷键

- 在资源管理器里右键 `.c/.cc/.cpp/.cxx/.h/.hpp` 文件，可以直接看到：
  - `C++ Checker: Scan Current File`
  - `C++ Checker: Fix Current File`
- 在编辑器里右键 C/C++ 文件内容，也能直接调用这两个命令。
- 左侧资源管理器会新增一个 `C++ Checker Issues` 视图：
  - 按文件分组显示当前工作区所有有问题的文件
  - 展开后能看到具体问题、行号和对应代码片段
  - 点击问题项会直接跳到代码位置
  - 视图顶部有“扫描工作区 / 一键修复工作区”按钮
  - 文件项右侧有“扫描当前文件 / 修复当前文件”操作
- 全量工作区扫描快捷键：
  - Windows / Linux: `Ctrl+Alt+Shift+S`
  - macOS: `Cmd+Alt+Shift+S`

### 安装使用

如果你不想走 `F5` 调试，可以直接安装打好的 `.vsix`：

```bash
code --install-extension cpp-code-checker-0.1.0.vsix
```

安装后，打开任意包含 C/C++ 文件的项目，插件会自动扫描；也可以在命令面板里手动运行扫描和修复命令。
