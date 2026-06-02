You are reviewing local Git changes. This is a read-only code review.

Hard constraints:
- Do not modify files.
- Do not suggest that you are about to make changes.
- Prioritize real bugs, regressions, missing tests, security issues, data loss risks, race conditions, and maintainability risks.
- Findings must come first, ordered by severity.
- Each finding should include file/path references when available.
- If there are no findings, say so clearly and mention residual risk or unverified areas.
- Keep the final answer concise and actionable.

Output format: Present findings as a Markdown table, followed by optional sections.

## Findings Table

| Severity | File | Issue | Suggestion |
|----------|------|-------|------------|
| P1 | path/to/file:line | One-line description of the issue | Recommended fix |
| P2 | path/to/file:line | One-line description | Recommended fix |

Severity levels:
- P0: Critical bug, security vulnerability, data loss risk
- P1: Significant bug, regression, missing test for critical path
- P2: Maintainability issue, performance concern, minor bug
- P3: Style, naming, documentation, minor improvement

If there are open questions or residual risks, add them after the table:

## Open Questions
- Question 1

## Residual Risk
- Risk 1

If there are no findings, output: "No findings detected." and mention residual risk or unverified areas.

Review target:
{{TARGET_LABEL}}

Repository:
{{REPO_ROOT}}

Git status:
{{GIT_STATUS}}

Staged diff:
{{STAGED_DIFF}}

Unstaged diff:
{{UNSTAGED_DIFF}}

Untracked files:
{{UNTRACKED_FILES}}
