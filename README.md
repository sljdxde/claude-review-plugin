# Claude Review For Codex

Use Claude Code from inside Codex for read-only code reviews of your current work.

This repository contains a local Codex plugin that mirrors the spirit of `openai/codex-plugin-cc`, but in the opposite direction: instead of using Codex from Claude Code, it lets Codex ask Claude Code to review a working tree or branch diff.

## What You Get

- `setup` checks whether Node, Git, and Claude Code are available and whether review can run in non-interactive mode.
- `review --scope working-tree` reviews staged, unstaged, and untracked text changes.
- `review --base <ref>` reviews a branch diff against a base ref such as `main`.
- `review --background` starts a detached review job and stores job metadata and logs.
- `status`, `result`, and `cancel` manage background review runs.
- A Codex skill entry plus forward-compatible command markdown files for future slash-command support.

## Requirements

- Node.js 22 or later
- Git installed and available on `PATH`
- Claude Code CLI installed on the same machine
- A Git repository to review

## Install

Add the local marketplace from this repository root:

```bash
codex plugin marketplace add .
```

Enable the plugin in Codex, then reload plugins if needed. In the tested setup, the plugin is enabled through Codex config as:

```toml
[plugins."claude-review@local-codex-plugins"]
enabled = true
```

Then run:

```bash
node plugins/claude-review/scripts/claude-review.mjs setup
```

## Usage

### Working Tree Review

```bash
node plugins/claude-review/scripts/claude-review.mjs review --scope working-tree --wait
node plugins/claude-review/scripts/claude-review.mjs review --scope working-tree --background
```

Use this when you want Claude to review uncommitted changes in the current repository.

### Branch Review

```bash
node plugins/claude-review/scripts/claude-review.mjs review --base main --wait
```

Use this when you want Claude to review the current branch compared with a base ref such as `main`.

### Background Jobs

```bash
node plugins/claude-review/scripts/claude-review.mjs status
node plugins/claude-review/scripts/claude-review.mjs result
node plugins/claude-review/scripts/claude-review.mjs cancel
```

Typical flow:

```bash
node plugins/claude-review/scripts/claude-review.mjs review --background
node plugins/claude-review/scripts/claude-review.mjs status
node plugins/claude-review/scripts/claude-review.mjs result
```

## Repository Layout

```text
.
├── .agents/plugins/marketplace.json
├── docs/
├── plugins/claude-review/
│   ├── .codex-plugin/plugin.json
│   ├── commands/
│   ├── prompts/
│   ├── schemas/
│   ├── scripts/
│   └── skills/
├── tests/
├── package.json
└── README.md
```

## Development

Run the automated test suite:

```bash
npm test
```

The test suite covers:

- argument parsing
- Git target resolution
- working-tree context collection
- Claude binary resolution on Windows
- direct API fallback when `claude -p` produces no output
- background job lifecycle and cancellation

## Integration Notes

This plugin always remains review-only. It does not apply patches or modify the repository under review.

If the local Claude CLI works normally, the plugin uses the local CLI. If `claude -p` or `claude ultrareview` is unusable under the current local configuration, the plugin can fall back to an Anthropic-compatible API configuration discovered from `~/.claude/settings.json`:

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_MODEL`

When that fallback is active:

- working-tree review uses direct API review
- branch review uses local diff review instead of `claude ultrareview`

## Limitations

- Public official Codex documentation for plugin slash-command manifest support was not found during implementation validation.
- `commands/` is kept as a forward-compatible target, but the current MVP relies on the script entrypoint and skill entry.
- Large diffs are intentionally constrained to avoid unsafe prompt inflation.

## Security

- Repository content sent for review goes through your local Claude configuration.
- Do not run this plugin on code you are not allowed to send to Claude or to your configured Anthropic-compatible endpoint.

## License

MIT
