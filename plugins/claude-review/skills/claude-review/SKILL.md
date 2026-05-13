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
   - Current working tree:
     `node <plugin-root>/scripts/claude-review.mjs review --scope working-tree --wait`
   - Against main:
     `node <plugin-root>/scripts/claude-review.mjs review --base main --wait`
   - Background:
     `node <plugin-root>/scripts/claude-review.mjs review --background`
3. If the user asks about job progress or output, use:
   - `status`
   - `result`
   - `cancel`
