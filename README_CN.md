<div align="center">

# Claude Review for Codex

**让 Codex 调用 Claude Code 进行智能代码审查**

[![npm version](https://img.shields.io/npm/v/codex-claude-review.svg)](https://www.npmjs.com/package/codex-claude-review)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**🌐 Language / 语言**

[English](./README.md) | [简体中文](./README_CN.md)

</div>

---

## 目录

- [这是什么？](#这是什么)
- [工作原理](#工作原理)
- [输出模式](#输出模式)
- [前置条件](#前置条件)
- [快速开始](#快速开始)
- [使用示例](#使用示例)
- [命令参考](#命令参考)
- [安全说明](#安全说明)
- [许可证](#许可证)

---

## 这是什么？

Claude Review for Codex 是一个将 Claude Code 集成到 Codex 中的插件，用于智能代码审查。

| 使用场景 | 说明 |
|----------|------|
| 提交前自查 | 提交前检查你的改动 |
| PR 审查 | 对比分支差异，获取审查反馈 |
| 学习代码 | 了解代码质量和改进建议 |
| 安全扫描 | 检测潜在漏洞和性能问题 |

---

## 工作原理

![Claude Review 工作原理](.assets/C1.png)

上图展示默认的 Claude Code CLI 本地调用路径。如果启用了并实际触发 Direct API 回退，diff 和 prompt 会发送到已配置的 Anthropic 兼容端点。

```
┌─────────────────────────────────────────────────────────────┐
│                        Codex CLI                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              claude-review 插件                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ 收集        │  │ 解析        │  │ 格式化       │  │  │
│  │  │ git diff    │→ │ 参数        │→ │ 输出         │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Claude Code CLI                          │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  分析 diff → 生成审查结果                        │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**工作流程：**

1. **收集改动** - 插件使用 `git diff` 收集你的代码改动
2. **调用 Claude Code** - 将 diff 发送给 Claude Code CLI 进行分析
3. **获取结果** - Claude Code 返回结构化的审查结果
4. **显示输出** - 插件格式化并显示结果

**关键点：**
- Claude Code 作为 **后台进程（subagent）** 在 Codex 中运行
- 默认通过 Claude Code CLI **本地优先** 执行分析
- 插件是 **只读的** - 永远不会修改你的代码

---

## 输出模式

Claude Review 支持两种输出模式：

| 模式 | 参数 | 说明 | 适用场景 |
|------|------|------|----------|
| **文本**（默认） | `--format=text` | Markdown 表格输出 | 快速审查、轻量查看 |
| **交互式** | `--format=table` | 生成 HTML 报告，可逐条选择处理方式 | 详细审查、批量确认 |

### 文本模式（默认）

输出干净的 Markdown 表格：

```markdown
| Severity | File | Issue | Suggestion |
|----------|------|-------|------------|
| P1 | src/app.js:42 | Missing null check | Add null check |
| P2 | src/utils.js:15 | Unused variable | Remove it |
```

### 交互式 HTML 模式

生成可交互的 HTML 报告，包含：
- P0/P1/P2/P3 严重性颜色标记
- 每条发现可选择 Fix / Skip / Custom
- 批量操作（全部选择修复、P3 跳过等）
- 导出选择结果为 JSON，便于后续自动化

```bash
# 生成并打开 HTML 报告
claude-review review --wait --format=table --open
```

### 自然语言触发

在 Codex 中可以用自然语言切换模式：

| 你说 | 结果 |
|------|------|
| “生成 HTML 报告” / “交互式确认” | 切换到交互式模式 |
| “简单模式” / “直接看结果” | 使用文本模式 |

---

## 前置条件

安装插件前，请确保你已安装：

| 依赖 | 安装命令 | 验证 |
|------|----------|------|
| Node.js 22+ | [下载](https://nodejs.org/) | `node --version` |
| Git | [下载](https://git-scm.com/) | `git --version` |
| Claude Code CLI | `npm install -g @anthropic-ai/claude-code` | `claude --version` |
| Codex CLI | [安装指南](https://github.com/openai/codex) | `codex --version` |

**安装 Claude Code 后，需要登录认证：**

```bash
claude auth login
```

---

## 快速开始

![Claude Review 快速开始](.assets/C3.png)

### 方式一：Agent 安装（推荐）

在 Codex 中直接说：

```
install codex-claude-review
```

或者：

```
帮我安装 codex-claude-review 插件
```

Agent 会自动完成安装和配置。

### 方式二：手动安装

```bash
# 安装插件
npm install -g codex-claude-review

# 启用 Codex 集成（将包根目录注册为本地 marketplace，并安装插件）
claude-review enable

# 验证环境和依赖
claude-review doctor
```

> **注意：** `enable` 命令会调用 Codex CLI 注册包根目录，并启用 `claude-review@local-codex-plugins`。

---

## 使用示例

![Claude Review 使用示例](.assets/C2.png)

### 示例 1：提交前审查改动

你做了一些改动，想在提交前检查：

```bash
$ claude-review review --scope working-tree --wait
```

输出：

```
代码审查发现

1. 缺少测试（高）
   文件: src/utils.js:15
   新导出的函数 calculate 没有单元测试。
   建议: 添加边界情况测试（负数、零、大数值）。

2. 输入验证（中）
   文件: src/utils.js:18
   函数没有验证输入是否为数字。
   建议: 计算前添加类型检查。

3. 魔法数字（低）
   文件: src/utils.js:22
   硬编码的值 100 应该用命名常量。
   建议: const MAX_RETRIES = 100;

总结: 发现 3 个问题（1 高，1 中，1 低）
```

### 示例 2：创建 PR 前审查分支

你完成了功能分支，想对比 main 进行审查：

```bash
$ claude-review review --base main --wait
```

输出：

```
代码审查发现

1. Bug: 导出被覆盖（高）
   文件: src/index.js:10
   第一次导出 module.exports = { add } 被第二次导出覆盖。
   修复: 合并为单条导出语句。

2. 缺少错误处理（中）
   文件: src/api.js:45
   fetch() 调用没有处理网络错误。
   修复: 添加 try/catch 或 .catch() 处理器。

3. 性能问题（低）
   文件: src/render.js:78
   数组在每次渲染时都会重新创建。
   修复: 使用 useMemo 缓存数组。

总结: 发现 3 个问题。建议合并前修复高严重性问题。
```

### 示例 3：后台运行审查

对于大型代码库，可以在后台运行审查：

```bash
# 启动后台审查
$ claude-review review --background
已启动后台审查: review-abc123-def456

# 稍后查看状态
$ claude-review status
运行中: review-abc123-def456 (working tree diff)

# 完成后获取结果
$ claude-review result review-abc123-def456
```

---

## 命令参考

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
| `--format <mode>` | 输出格式：`text`（默认）或 `table`（交互式 HTML） |
| `--output <dir>` | HTML 报告输出目录（默认 `.claude-review/`） |
| `--open` | 自动在浏览器中打开 HTML 报告 |
| `--json` | JSON 格式输出（尽力解析，失败时回退为原始文本） |

---

## 安全说明

- **只读模式** - 插件永远不会修改你的代码
- **本地优先** - 默认情况下，分析通过 Claude Code CLI 在本地运行
- **Direct API 回退** - 当 Claude CLI 不可用时，插件可能回退到已配置的 Anthropic 兼容 API 端点。在此模式下，diff 和 prompt 会被发送到远程端点。设置 `CLAUDE_REVIEW_FORCE_CLAUDE_CLI=1` 可完全禁用回退
- **仅支持 Git** - 只能用于 Git 仓库

---

## 许可证

MIT
