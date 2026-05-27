<div align="center">

# Claude Review for Codex

**Smart code review powered by Claude Code**

[![npm version](https://img.shields.io/npm/v/codex-claude-review.svg)](https://www.npmjs.com/package/codex-claude-review)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | [中文](README_CN.md)

</div>

---

## What can it do?

| Use Case | Description |
|----------|-------------|
| Pre-commit Check | Review working tree changes before committing |
| PR Review | Compare branch diffs, simulate code review |
| Code Learning | Let Claude analyze code quality and suggest improvements |
| Security Scan | Detect potential security vulnerabilities and performance risks |

## Highlights

- Smart Review - Automatically identifies code issues, security vulnerabilities, and performance risks
- Zero Config - Install and use, no complex setup required
- Dual Mode - Supports working tree review and branch comparison
- Background Jobs - Large review tasks can run in the background
- Read-Only Safe - Never modifies your code

## Quick Start

### Option 1: Agent Install (Recommended)

Just say this in Claude Code or Codex:

```
install codex-claude-review
```

The agent will handle installation and setup automatically.

### Option 2: Manual Install

```bash
npm install -g codex-claude-review
claude-review enable
claude-review doctor
```

## Usage

### Use in Codex (Recommended)

After installation, use natural language:

```
Let Claude review my current changes
Use Claude to check this branch
Claude review against main
```

### Command Line

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

## Examples

### Example 1: Review working tree changes

```
$ claude-review review --scope working-tree --wait
```

Output:

```
Code Review Findings

1. Missing Tests for New Exported Function (Maintainability Risk)
   File: src/utils.js
   A new public function "calculate" is exported but no corresponding unit tests
   have been added. This increases the risk of future regressions.

2. No Input Validation (Robustness Issue)
   File: src/utils.js
   The function performs calculation without validating inputs. If called with
   non-numeric inputs, the result may be unexpected.

Summary
The change introduces a utility function with export. No critical bugs or security
issues were identified. The primary concerns are the absence of tests and lack of
input validation.
```

### Example 2: Branch comparison review

```
$ claude-review review --base main --wait
```

Output:

```
Code Review Findings

1. Bug: Module Export Overwrite
   The initial "module.exports = { add }" is immediately overwritten by
   "module.exports = { add, multiply }". This makes the first export dead code.
   Fix: Remove the first export or combine them into a single export.

2. Missing Tests
   No tests were added for the new "multiply" function.

Suggested Fix:
   function add(a, b) { return a + b; }
   function multiply(a, b) { return a * b; }
   module.exports = { add, multiply };
```

### Example 3: Background task management

```
# Start background review
$ claude-review review --background
Claude review started in the background as review-mpm1icqi-f477cd.
Check /claude:status review-mpm1icqi-f477cd for progress.

# Check status
$ claude-review status
Claude Review jobs for /path/to/project

Running:
- none

Recent:
- review-mpm1icqi-f477cd | working tree diff | completed

# View result
$ claude-review result review-mpm1icqi-f477cd
Claude Review result: review-mpm1icqi-f477cd
Target: working tree diff
Status: completed

Findings (ordered by severity):
1. High - Duplicate module.exports overwrites previous exports
   ...
```

## Command Reference

| Command | Description |
|---------|-------------|
| claude-review enable | Enable Codex plugin integration |
| claude-review doctor | Check environment dependencies |
| claude-review review | Run code review |
| claude-review status | Show background job status |
| claude-review result | Show review results |
| claude-review cancel | Cancel a running job |

## Review Options

| Option | Description |
|--------|-------------|
| --scope <type> | Review scope: working-tree, branch, or auto (default) |
| --base <ref> | Base branch for comparison (e.g., main, master) |
| --wait | Wait for result in foreground |
| --background | Run in background (default) |
| --timeout <min> | Timeout in minutes (default: 30) |
| --json | JSON output format |
| --cwd <path> | Specify working directory |

## Requirements

- Node.js 22+
- Git repository (the project must be managed by Git)
- Claude Code CLI (npm install -g @anthropic-ai/claude-code)
- Claude Code authenticated (claude auth login)

> Note: This plugin only works with Git repositories. Non-Git projects are not supported.

## Security

- Plugin is always read-only, never modifies your code
- Code content is sent via local Claude Code CLI, do not use on unauthorized code
- Review results are saved locally only, not uploaded to third-party services

---

## License

MIT
