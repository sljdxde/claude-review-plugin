<div align="center">

# Claude Review for Codex

**让 Codex 调用 Claude Code 进行智能代码审查**

[![npm version](https://img.shields.io/npm/v/codex-claude-review.svg)](https://www.npmjs.com/package/codex-claude-review)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | [中文](README_CN.md)

</div>

---

## 能干什么？

| 场景 | 说明 |
|------|------|
| 提交前自查 | 审查工作区改动，发现问题再提交 |
| PR 审查 | 对比分支差异，模拟 code review |
| 学习代码 | 让 Claude 分析代码质量，给出改进建议 |
| 安全扫描 | 检测潜在的安全漏洞和性能风险 |

## 亮点

- 智能审查 - 自动识别代码问题、安全漏洞、性能风险
- 零配置 - 安装即用，无需复杂配置
- 双模式 - 支持工作区审查和分支对比
- 后台运行 - 大型审查任务可后台执行
- 只读安全 - 永远不会修改你的代码

## 快速开始

### 方式一：Agent 安装（推荐）

在 Claude Code 或 Codex 中直接说：

```
帮我安装 codex-claude-review 插件
```

或者：

```
install codex-claude-review
```

Agent 会自动完成安装和配置。

### 方式二：手动安装

```bash
npm install -g codex-claude-review
claude-review enable
claude-review doctor
```

## 使用方式

### 在 Codex 中使用（推荐）

安装后直接用自然语言：

```
让 Claude review 我的当前改动
用 Claude 检查一下这个分支
Claude review against main
```

### 命令行使用

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

## 使用案例

### 案例 1：审查工作区改动

```
$ claude-review review --scope working-tree --wait
```

输出：

```
代码审查发现

1. 新导出函数缺少测试（可维护性风险）
   文件: src/utils.js
   新的公共函数 calculate 被导出，但没有添加相应的单元测试。
   这会增加未来回归问题的风险。

2. 缺少输入验证（健壮性问题）
   文件: src/utils.js
   函数执行计算时没有验证输入。如果传入非数字参数，结果可能不符合预期。

总结
本次更改引入了一个工具函数并导出。未发现关键 bug 或安全问题。
主要问题是缺少测试和输入验证。
```

### 案例 2：分支对比审查

```
$ claude-review review --base main --wait
```

输出：

```
代码审查发现

1. Bug: 模块导出被覆盖
   初始的 module.exports = { add } 立即被 module.exports = { add, multiply } 覆盖。
   这使得第一次导出成为死代码。
   修复: 删除第一次导出或合并为单次导出。

2. 缺少测试
   新的 multiply 函数没有添加测试。

建议修复代码:
   function add(a, b) { return a + b; }
   function multiply(a, b) { return a * b; }
   module.exports = { add, multiply };
```

### 案例 3：后台任务管理

```
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
1. High - Duplicate module.exports overwrites previous exports
   ...
```

## 命令参考

| 命令 | 说明 |
|------|------|
| claude-review enable | 启用 Codex 插件集成 |
| claude-review doctor | 检查环境依赖 |
| claude-review review | 运行代码审查 |
| claude-review status | 查看后台任务状态 |
| claude-review result | 查看审查结果 |
| claude-review cancel | 取消运行中的任务 |

## 审查选项

| 选项 | 说明 |
|------|------|
| --scope <type> | 审查范围：working-tree、branch 或 auto（默认） |
| --base <ref> | 分支对比的基准（如 main、master） |
| --wait | 前台等待结果 |
| --background | 后台运行（默认） |
| --timeout <min> | 超时时间（分钟，默认 30） |
| --json | JSON 格式输出 |
| --cwd <path> | 指定工作目录 |

## 环境要求

- Node.js 22+
- Git 仓库（项目必须使用 Git 管理）
- Claude Code CLI（npm install -g @anthropic-ai/claude-code）
- Claude Code 已登录（claude auth login）

> 注意：此插件仅支持 Git 仓库，不支持非 Git 项目。

## 安全说明

- 插件始终为只读模式，永远不会修改你的代码
- 代码内容通过本地 Claude Code CLI 发送，请勿在未授权代码上使用
- 审查结果仅保存在本地，不会上传到第三方服务

---

## 许可证

MIT
