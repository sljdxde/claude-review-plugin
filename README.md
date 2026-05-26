<div align="center">

# Claude Review for Codex

**让 Codex 调用 Claude Code 进行智能代码审查**

[![npm version](https://img.shields.io/npm/v/codex-claude-review.svg)](https://www.npmjs.com/package/codex-claude-review)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](#english) | [中文](#中文)

</div>

---

## 中文

### 亮点

- **智能审查** - 自动识别代码问题、安全漏洞、性能风险
- **零配置** - 安装即用，无需复杂配置
- **双模式** - 支持工作区审查和分支对比
- **后台运行** - 大型审查任务可后台执行
- **只读安全** - 永远不会修改你的代码

### 快速开始

```bash
# 1. 安装
npm install -g codex-claude-review

# 2. 启用插件
claude-review enable

# 3. 检查环境
claude-review doctor

# 4. 开始使用
claude-review review --scope working-tree --wait
```

### 使用方式

#### 方式一：在 Codex 中使用（推荐）

安装后直接在 Codex 中用自然语言：

```
让 Claude review 我的当前改动
用 Claude 检查一下这个分支
Claude review against main
```

#### 方式二：命令行使用

```bash
# 审查当前工作区改动
claude-review review --scope working-tree --wait

# 审查分支差异（对比 main）
claude-review review --base main --wait

# 后台运行审查
claude-review review --background

# 查看任务状态
claude-review status

# 查看审查结果
claude-review result
```

### 使用案例

#### 案例 1：审查工作区改动

```bash
$ claude-review review --scope working-tree --wait
```

```
**Code Review Findings**

1. **Missing Tests for New Exported Function** (Maintainability Risk)
   - File: `src/utils.js`
   - Description: A new public function `calculate` is exported but no corresponding 
     unit tests have been added. This increases the risk of future regressions.

2. **No Input Validation** (Robustness Issue)
   - File: `src/utils.js`
   - Description: The function performs calculation without validating inputs. 
     If called with non-numeric inputs, the result may be unexpected.

**Summary**
The change introduces a utility function with export. No critical bugs or security 
issues were identified. The primary concerns are the absence of tests and lack of 
input validation.
```

#### 案例 2：分支对比审查

```bash
$ claude-review review --base main --wait
```

```
**Code Review Findings**

1. **Bug: Module Export Overwrite**
   - The initial `module.exports = { add };` is immediately overwritten by 
     `module.exports = { add, multiply };`. This makes the first export dead code.
   - **Fix:** Remove the first export or combine them into a single export.

2. **Missing Tests**
   - No tests were added for the new `multiply` function.

**Suggested Revised Code:**
```javascript
function add(a, b) { return a + b; }
function multiply(a, b) { return a * b; }
module.exports = { add, multiply };
```
```

#### 案例 3：后台任务管理

```bash
# 启动后台审查
$ claude-review review --background
Claude review started in the background as review-mpm1icqi-f477cd.
Check /claude:status review-mpm1icqi-f477cd for progress.

# 查看状态
$ claude-review status
Claude Review jobs for /path/to/project

Running:
- none

Recent:
- review-mpm1icqi-f477cd | working tree diff | completed

# 查看结果
$ claude-review result review-mpm1icqi-f477cd
Claude Review result: review-mpm1icqi-f477cd
Target: working tree diff
Status: completed

Findings (ordered by severity):
1. **High - Duplicate module.exports overwrites previous exports**
   ...
```

### 命令参考

| 命令 | 说明 |
|------|------|
| `claude-review enable` | 启用 Codex 插件集成 |
| `claude-review doctor` | 检查环境依赖 |
| `claude-review review` | 运行代码审查 |
| `claude-review status` | 查看后台任务状态 |
| `claude-review result` | 查看审查结果 |
| `claude-review cancel` | 取消运行中的任务 |

### 审查选项

| 选项 | 说明 |
|------|------|
| `--scope <type>` | 审查范围：`working-tree`、`branch` 或 `auto`（默认） |
| `--base <ref>` | 分支对比的基准（如 `main`、`master`） |
| `--wait` | 前台等待结果 |
| `--background` | 后台运行（默认） |
| `--timeout <min>` | 超时时间（分钟，默认 30） |
| `--json` | JSON 格式输出 |
| `--cwd <path>` | 指定工作目录 |

### 环境要求

- Node.js 22+
- Git
- Claude Code CLI（`npm install -g @anthropic-ai/claude-code`）
- Claude Code 已登录（`claude auth login`）

### 安全说明

- 插件始终为**只读模式**，永远不会修改你的代码
- 代码内容通过本地 Claude Code CLI 发送，请勿在未授权代码上使用
- 审查结果仅保存在本地，不会上传到第三方服务

---

## English

### Highlights

- **Smart Review** - Automatically identifies code issues, security vulnerabilities, and performance risks
- **Zero Config** - Install and use, no complex setup required
- **Dual Mode** - Supports working tree review and branch comparison
- **Background Jobs** - Large review tasks can run in the background
- **Read-Only Safe** - Never modifies your code

### Quick Start

```bash
# 1. Install
npm install -g codex-claude-review

# 2. Enable plugin
claude-review enable

# 3. Check environment
claude-review doctor

# 4. Start using
claude-review review --scope working-tree --wait
```

### Usage

#### Option 1: Use in Codex (Recommended)

After installation, use natural language in Codex:

```
Let Claude review my current changes
Use Claude to check this branch
Claude review against main
```

#### Option 2: Command Line

```bash
# Review current working tree changes
claude-review review --scope working-tree --wait

# Review branch diff (against main)
claude-review review --base main --wait

# Run review in background
claude-review review --background

# Check job status
claude-review status

# View review results
claude-review result
```

### Command Reference

| Command | Description |
|---------|-------------|
| `claude-review enable` | Enable Codex plugin integration |
| `claude-review doctor` | Check environment dependencies |
| `claude-review review` | Run code review |
| `claude-review status` | Show background job status |
| `claude-review result` | Show review results |
| `claude-review cancel` | Cancel a running job |

### Requirements

- Node.js 22+
- Git
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- Claude Code authenticated (`claude auth login`)

### Security

- Plugin is always **read-only**, never modifies your code
- Code content is sent via local Claude Code CLI, do not use on unauthorized code
- Review results are saved locally only, not uploaded to third-party services

---

## License

MIT
