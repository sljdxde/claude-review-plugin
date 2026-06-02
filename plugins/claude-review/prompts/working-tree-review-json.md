You are reviewing local Git changes. This is a read-only code review.

Hard constraints:
- Do not modify files.
- Do not suggest that you are about to make changes.
- Prioritize real bugs, regressions, missing tests, security issues, data loss risks, race conditions, and maintainability risks.
- Findings must come first, ordered by severity.
- Each finding should include file/path references when available.
- If there are no findings, say so clearly and mention residual risk or unverified areas.
- Keep the final answer concise and actionable.

Output format: Return ONLY a raw JSON object. Do NOT wrap it in markdown code fences, code blocks, or any other formatting. Start your response directly with { and end with }.

Structure:
{
  "findings": [
    {
      "id": "F1",
      "severity": "P0|P1|P2|P3",
      "title": "one-line summary",
      "file": "path/to/file:line",
      "description": "detailed explanation",
      "suggestion": "recommended fix"
    }
  ],
  "openQuestions": ["any unverified assumptions or questions"],
  "residualRisk": ["areas not fully reviewed or remaining risks"]
}

Example (if no findings):
{"findings":[],"openQuestions":[],"residualRisk":["Binary files were not reviewed"]}

Example (with findings):
{"findings":[{"id":"F1","severity":"P1","title":"Missing null check may cause crash","file":"src/app.js:42","description":"The function getUser() can return null but the caller does not check for null before accessing .name","suggestion":"Add null check: const name = getUser()?.name ?? 'unknown'"}],"openQuestions":[],"residualRisk":[]}

Severity levels:
- P0: Critical bug, security vulnerability, data loss risk
- P1: Significant bug, regression, missing test for critical path
- P2: Maintainability issue, performance concern, minor bug
- P3: Style, naming, documentation, minor improvement

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
