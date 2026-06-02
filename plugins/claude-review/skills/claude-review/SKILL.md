---
name: claude-review
description: Use when the user asks Codex to have Claude Code review local changes, branch diffs, pull requests, or asks for a second-model review from Claude.
---

Run the local companion script only. This skill is review-only.

Rules:
- Do not replace Claude review with Codex's own review.
- Do not modify files before or during the Claude review request.
- Do not "fix" issues that Claude reports unless the user separately asks for implementation work.
- Return the script output directly; do not rewrite findings in a way that changes meaning.

Workflow:
1. Run setup first:
   `node <plugin-root>/scripts/claude-review.mjs setup`
2. Choose the command based on user intent:
   - Current working tree (default, Markdown table output):
     `node <plugin-root>/scripts/claude-review.mjs review --scope working-tree --wait`
   - Against main:
     `node <plugin-root>/scripts/claude-review.mjs review --base main --wait`
   - Background:
     `node <plugin-root>/scripts/claude-review.mjs review --background`
3. If the user asks about job progress or output, use:
   - `status`
   - `result`
   - `cancel`

Output Modes:
- Default (`--format=text`): Outputs Markdown table. Readable, lightweight.
- Interactive (`--format=table`): Generates HTML report with checkboxes for each finding. User can select Fix/Skip/Custom per finding and export selections as JSON.

Natural Language Triggers:
- If user says "生成 HTML 报告", "交互式确认", "我要选择哪些需要修复", "表格模式", or similar intent for interactive review:
  Add `--format=table --open` to the review command.
- If user says "简单模式", "直接看结果", "不需要交互", or similar intent for simple output:
  Use default `--format=text`.
- After showing Markdown table results, if user says "生成 HTML 报告" or "转成交互模式":
  Rerun with `--format=table --open` or generate HTML from the existing result.
