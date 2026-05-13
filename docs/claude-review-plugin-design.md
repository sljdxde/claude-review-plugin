# Codex Claude Review Plugin 设计方案

## 1. 结论

推荐实现一个 Codex 插件，暂名 `claude-review`，目标是在 Codex 中获得接近 `openai/codex-plugin-cc` 的 slash command 体验，用本机 Claude Code CLI 对当前仓库进行只读 review。

MVP 必须同时支持两类 review：

- 当前工作区未提交改动 review：通过 `git status`、`git diff`、untracked 文本文件收集上下文，再调用 `claude -p`。
- branch/base review：优先调用 `claude ultrareview`，让 Claude Code 自己执行云端多智能体 review。

目标用户体验是：

```text
/claude:setup
/claude:review
/claude:review --base main
/claude:review --scope working-tree
/claude:review --scope branch
/claude:review --background
/claude:status
/claude:result
/claude:cancel
```

如果 Codex 当前插件系统不能原生注册 slash command，则实现应保留同名脚本子命令和 skill 触发入口，并把原生 slash command 支持作为第一项技术验证。不能静默降级成普通“自然语言提示”而不说明差异。

## 2. 背景和参考

参考项目是 `openai/codex-plugin-cc`。它的方向是“在 Claude Code 里调用 Codex”，本项目方向相反，是“在 Codex 里调用 Claude Code”。

参考项目的关键结构：

- marketplace 文件：`.claude-plugin/marketplace.json`
- 插件目录：`plugins/codex`
- 插件 manifest：`plugins/codex/.claude-plugin/plugin.json`
- 命令入口：`plugins/codex/commands/*.md`
- 主脚本：`plugins/codex/scripts/codex-companion.mjs`
- 子模块：`scripts/lib/*.mjs`
- 状态和 job：per-workspace state、job json、job log
- setup：检查 CLI 安装和认证
- review：支持 foreground/background
- status/result/cancel：管理后台任务
- 可选 hook gate：Stop hook 触发 review gate

本项目不能直接复制 `.claude-plugin` 结构。Codex 插件 manifest 应是 `.codex-plugin/plugin.json`，Codex 插件当前可见能力主要是 `skills`、`apps`、`mcpServers`、`hooks` 这类字段。

## 3. 当前已验证事实

本机环境已验证：

- 当前工作目录：`D:\project\99.杂项\099codex-plugin`
- 当前目录为空，且不是 Git 仓库。
- 已安装 `codex-cli 0.130.0`。
- `codex plugin marketplace add --help` 支持添加本地或远程 marketplace。
- 已安装 `claude 2.1.140 (Claude Code)`。
- `claude -p/--print` 支持非交互输出。
- `claude ultrareview --help` 显示可运行 branch/PR/base review，并支持 `--json`、`--timeout <minutes>`。
- 本机 Codex 插件缓存中暂未发现 `commands/*.md` 这类可注册 slash command 的 Codex 插件样例。

因此，实现前必须先验证 Codex 是否已有未公开或新版本 slash command 插件能力。

## 4. 目标

### 4.1 产品目标

用户在 Codex 中开发时，可以快速让 Claude Code 独立 review 当前改动，得到第二模型视角。

核心价值：

- 不离开 Codex 当前工作流。
- Claude 只读 review，不修改文件。
- 支持工作区 diff 和 branch/base diff 两种主要场景。
- 长 review 可以后台运行。
- review 结果可追踪、可重复查看、可取消。

### 4.2 交互目标

理想入口是 slash command：

```text
/claude:review --base main --background
```

体验要尽量接近 `codex-plugin-cc` 中 Claude Code 的：

```text
/codex:review
/codex:status
/codex:result
/codex:cancel
```

如果 Codex 原生不支持插件命令，MVP 的兼容入口是：

```text
让 Claude review 当前改动
让 Claude review against main
运行 claude-review setup
```

同时脚本必须能被手动调用，便于测试和后续接入真正 slash command：

```bash
node plugins/claude-review/scripts/claude-review.mjs review --base main
node plugins/claude-review/scripts/claude-review.mjs status
node plugins/claude-review/scripts/claude-review.mjs result
```

## 5. 非目标

MVP 不做这些事：

- 不让 Claude 自动修改代码。
- 不实现 stop-time review gate。
- 不实现 Claude interactive session 的远程控制。
- 不解析 Claude 内部会话数据库。
- 不把 Claude review 转换成 Codex inline code comments。
- 不支持多仓库批量 review。
- 不做 PR 评论发布。
- 不绕过 Claude Code 的认证或权限模型。

后续版本可以再扩展：

- `/claude:adversarial-review`
- `/claude:rescue`
- stop gate
- GitHub PR 评论
- 结构化 JSON schema review 输出
- 与 Codex inline comments 对接

## 6. 命令设计

### 6.1 `/claude:setup`

用途：检查本机 Claude Code 是否可用。

行为：

- 运行 `node --version`。
- 运行 `claude --version`。
- 运行 `claude -p "Reply with OK only."` 做最小认证/可调用性检查。
- 运行 `git --version`。
- 输出当前插件数据目录、状态目录、可用命令。

不能做的事：

- 不自动安装 Claude Code，除非后续明确设计交互确认。
- 不静默登录。
- 不修改用户 Claude 配置。

输出应包含：

- `ready: true/false`
- `node.available`
- `claude.available`
- `claude.authUsable`
- `git.available`
- `nextSteps`

### 6.2 `/claude:review`

用途：对当前工作进行普通 review。

支持参数：

```text
--wait
--background
--base <ref>
--scope auto|working-tree|branch
--timeout <minutes>
--json
--cwd <path>
```

参数语义：

- `--wait`：前台等待结果。
- `--background`：启动后台 job，立即返回 job id。
- `--base <ref>`：review 当前 HEAD 相对指定 base 的 branch diff。
- `--scope working-tree`：强制 review 未提交改动。
- `--scope branch`：强制 review 当前分支相对默认分支。
- `--scope auto`：默认。若工作区 dirty，review working tree；否则 review branch。
- `--timeout <minutes>`：传给 `claude ultrareview` 或作为 `claude -p` 子进程超时。
- `--json`：输出机器可读结果。
- `--cwd <path>`：用于脚本测试和跨目录调用；正常命令从当前 Codex workspace 推导。

默认模式：

- 未传 `--wait` 或 `--background` 时，先估算 review 大小。
- 明确很小的改动可以建议前台等待。
- 其他情况建议后台。
- 如果 Codex slash command 入口不能 AskUser，则默认后台更稳。

review 类型选择：

- `working-tree`：使用本插件自行收集 diff，然后调用 `claude -p`。
- `branch`：优先调用 `claude ultrareview <base>`。

### 6.3 `/claude:status`

用途：展示当前仓库的 Claude review job。

支持参数：

```text
[job-id]
--all
--json
```

行为：

- 无 `job-id` 时展示最近 job 列表。
- 有 `job-id` 时展示单个 job 的状态、目标、开始时间、耗时、pid、log 文件。
- 默认只展示当前 workspace 的 job。
- `--all` 展示历史 job，包括 completed、failed、cancelled。

### 6.4 `/claude:result`

用途：展示最近或指定 job 的最终 review 输出。

支持参数：

```text
[job-id]
--json
```

行为：

- 找到最近 completed/failed/cancelled job。
- 输出 review 文本。
- 如果 job 失败，输出 stderr 摘要和 log path。
- `--json` 输出完整 payload。

### 6.5 `/claude:cancel`

用途：取消后台 job。

支持参数：

```text
[job-id]
--json
```

行为：

- 默认取消当前 workspace 最近 running/queued job。
- Windows 下必须终止进程树，而不是只 kill 父进程。
- 状态更新为 `cancelled`。
- 追加日志 `Cancelled by user.`。

## 7. Slash Command 支持策略

### 7.1 期望实现

如果 Codex 插件支持类似 Claude Code 的命令目录，应使用：

```text
plugins/claude-review/commands/setup.md
plugins/claude-review/commands/review.md
plugins/claude-review/commands/status.md
plugins/claude-review/commands/result.md
plugins/claude-review/commands/cancel.md
```

每个命令文件只做薄封装：

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-review.mjs" review "$ARGUMENTS"
```

命令文件职责：

- 约束命令是 review-only。
- 保留用户参数。
- 前台时原样返回脚本 stdout。
- 后台时只告诉用户 job id 和 status/result 命令。

### 7.2 当前风险

截至本设计编写时，本机已安装 Codex 插件样例没有出现 `commands/` 目录，也没有在 `.codex-plugin/plugin.json` 样例中看到 `commands` 字段。

实现者必须先完成验证：

1. 查 Codex 当前版本文档或源码，确认 `.codex-plugin/plugin.json` 是否支持 slash command。
2. 用最小本地插件验证 `/claude:setup` 是否能出现在 Codex UI/CLI 中。
3. 如果不支持，记录 Codex 版本、验证命令、失败现象。

### 7.3 兼容实现

如果原生 slash command 暂不可用，应实现这些兼容层：

- `skills/claude-review/SKILL.md`：当用户说“让 Claude review”“Claude review 当前 diff”“用 Claude 看一下”时触发。
- `interface.defaultPrompt`：提供可点击 starter prompt。
- `scripts/claude-review.mjs`：保留完全同名子命令，等待未来 slash command 接入。

兼容层不能改变核心架构。后续一旦 Codex 支持命令，只需新增命令入口，不重写 review 引擎。

## 8. 仓库结构

建议结构：

```text
.
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── docs/
│   └── claude-review-plugin-design.md
├── plugins/
│   └── claude-review/
│       ├── .codex-plugin/
│       │   └── plugin.json
│       ├── skills/
│       │   └── claude-review/
│       │       └── SKILL.md
│       ├── commands/
│       │   ├── setup.md
│       │   ├── review.md
│       │   ├── status.md
│       │   ├── result.md
│       │   └── cancel.md
│       ├── prompts/
│       │   └── working-tree-review.md
│       ├── schemas/
│       │   └── review-output.schema.json
│       └── scripts/
│           ├── claude-review.mjs
│           └── lib/
│               ├── args.mjs
│               ├── claude.mjs
│               ├── fs.mjs
│               ├── git.mjs
│               ├── process.mjs
│               ├── render.mjs
│               ├── state.mjs
│               ├── tracked-jobs.mjs
│               └── workspace.mjs
└── tests/
    ├── args.test.mjs
    ├── git.test.mjs
    ├── render.test.mjs
    ├── state.test.mjs
    └── commands.test.mjs
```

说明：

- `commands/` 先保留为目标结构。若 Codex 不支持，不从 `plugin.json` 暴露，但文件仍可作为未来接入设计。
- 核心逻辑必须放在 `scripts/lib`，不要写进 command 或 skill 文档。
- `scripts/claude-review.mjs` 是唯一 CLI 入口。
- 测试直接测脚本和 lib，不依赖 Codex UI。

## 9. Manifest 设计

`plugins/claude-review/.codex-plugin/plugin.json`：

```json
{
  "name": "claude-review",
  "version": "0.1.0",
  "description": "Run read-only Claude Code reviews from Codex.",
  "author": {
    "name": "Local"
  },
  "license": "MIT",
  "keywords": [
    "claude",
    "review",
    "code-review",
    "codex"
  ],
  "skills": "./skills/",
  "interface": {
    "displayName": "Claude Review",
    "shortDescription": "Ask Claude Code to review your current changes",
    "longDescription": "Claude Review lets Codex invoke the local Claude Code CLI for read-only reviews of working-tree changes or branch diffs.",
    "developerName": "Local",
    "category": "Coding",
    "capabilities": [
      "Interactive",
      "Read"
    ],
    "defaultPrompt": [
      "Ask Claude to review my current changes",
      "Ask Claude to review this branch against main",
      "Check whether Claude Code review is set up"
    ],
    "brandColor": "#6B5BFF",
    "screenshots": []
  }
}
```

如果后续确认 Codex 支持 `commands` 字段，再补：

```json
{
  "commands": "./commands/"
}
```

不要在未验证前把 `commands` 写进 manifest，避免插件安装失败。

## 10. Marketplace 设计

repo-local marketplace：

```text
.agents/plugins/marketplace.json
```

建议内容：

```json
{
  "name": "local-codex-plugins",
  "interface": {
    "displayName": "Local Codex Plugins"
  },
  "plugins": [
    {
      "name": "claude-review",
      "source": {
        "source": "local",
        "path": "./plugins/claude-review"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Coding"
    }
  ]
}
```

安装验证命令：

```bash
codex plugin marketplace add .
```

如 Codex 要求 marketplace root 是包含 `.agents/plugins/marketplace.json` 的目录，则在仓库根目录执行。

## 11. Review 目标解析

### 11.1 Git 仓库要求

所有 review 命令必须运行在 Git 仓库内。

检查：

```bash
git rev-parse --show-toplevel
```

失败时输出：

```text
This command must run inside a Git repository.
```

### 11.2 scope 解析

输入：

- `cwd`
- `--base`
- `--scope`

输出：

```js
{
  mode: "working-tree" | "branch",
  label: "working tree diff" | "branch diff against main",
  baseRef: "main" | null,
  explicit: true | false
}
```

规则：

- 有 `--base <ref>`：固定 `branch`。
- `--scope working-tree`：固定 `working-tree`。
- `--scope branch`：检测默认分支并固定 `branch`。
- `--scope auto`：
  - 工作区 dirty：`working-tree`
  - 工作区干净：`branch`

dirty 判断包含：

- staged diff
- unstaged diff
- untracked files

### 11.3 默认分支检测

按顺序：

1. `git symbolic-ref refs/remotes/origin/HEAD`
2. 本地 `main`
3. 远端 `origin/main`
4. 本地 `master`
5. 远端 `origin/master`
6. 本地 `trunk`
7. 远端 `origin/trunk`

失败时要求用户传 `--base <ref>` 或 `--scope working-tree`。

## 12. Working Tree Review 设计

### 12.1 为什么不用 `claude ultrareview`

`claude ultrareview` 的 help 显示目标是当前分支、PR 或 base branch。它不明确承诺 review 未提交 working tree 改动。

因此 working tree review 应由插件自行收集上下文，再调用：

```bash
claude -p --permission-mode dontAsk --output-format text "<prompt>"
```

权限模式需要实际验证。如果 `dontAsk` 不适合只读场景，可改成默认权限或 `--permission-mode default`，但不能使用会授权写操作的模式。

### 12.2 上下文收集

必须收集：

```bash
git status --short --untracked-files=all
git diff --cached --binary --no-ext-diff --submodule=diff
git diff --binary --no-ext-diff --submodule=diff
git ls-files --others --exclude-standard
```

untracked 文件处理：

- 只读取文本文件。
- 单文件上限建议 24 KiB。
- 二进制文件跳过。
- 目录跳过。
- 读取失败时记录 skipped 原因。

文本判断：

- Buffer 中有 NUL 字节视为二进制。
- UTF-8 decode 出错时视为二进制或 unreadable。

上下文过大策略：

- 默认内联 diff 上限：256 KiB。
- 默认内联文件数上限：20。
- 超过上限时不要把完整 diff 塞进 prompt。
- 改为给 Claude 文件列表、diff stat、状态摘要，并要求 Claude 自行用只读 shell/git 命令检查。

但 MVP 中 `claude -p` 如果没有工具权限，可能无法自行检查。为降低风险，MVP 可先直接失败并提示：

```text
The working-tree diff is too large to inline safely. Retry with --base <ref> or reduce the diff size.
```

后续版本再实现 Claude 可用工具的 self-collect 模式。

### 12.3 Prompt 模板

`prompts/working-tree-review.md`：

```text
You are reviewing local Git changes. This is a read-only code review.

Hard constraints:
- Do not modify files.
- Do not suggest that you are about to make changes.
- Prioritize real bugs, regressions, missing tests, security issues, data loss risks, race conditions, and maintainability risks.
- Findings must come first, ordered by severity.
- Each finding should include file/path references when available.
- If there are no findings, say so clearly and mention residual risk or unverified areas.
- Keep the final answer concise and actionable.

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
```

输出格式建议：

```text
Findings
- [P1] ...

Open Questions
- ...

Residual Risk
- ...
```

不要强制 JSON 作为 MVP 默认输出。Claude review 的自然语言质量比结构化解析更重要。

## 13. Branch/Base Review 设计

### 13.1 首选执行

当目标是 branch/base review：

```bash
claude ultrareview <baseRef> --timeout <minutes>
```

如果用户传 `--json`：

```bash
claude ultrareview <baseRef> --json --timeout <minutes>
```

如果 `<baseRef>` 为空，由插件检测默认分支。

### 13.2 输出处理

前台模式：

- stdout 原样输出。
- stderr 如果非空，附在失败信息中。
- exit code 非 0 时设置脚本 `process.exitCode`。

后台模式：

- stdout/stderr 写入 job log。
- 完成后将 stdout 存入 job json 的 `result.rawOutput`。
- 如果 `--json`，尝试解析 stdout 为 JSON；解析失败保留 raw。

### 13.3 fallback

如果 `claude ultrareview` 不可用：

- 检测 `claude ultrareview --help`。
- 若失败，则 fallback 到 `git diff <merge-base>..HEAD` + `claude -p`。
- fallback 需要在输出里说明：

```text
Claude ultrareview is unavailable; used local diff review via claude -p.
```

## 14. 后台 Job 设计

### 14.1 Job 状态

状态枚举：

```text
queued
running
completed
failed
cancelled
```

阶段枚举：

```text
queued
collecting-context
starting-claude
reviewing
finalizing
completed
failed
cancelled
```

### 14.2 Job 记录

每个 job 的 JSON：

```json
{
  "id": "review-lx2abc-4f9k2p",
  "kind": "review",
  "title": "Claude Review",
  "status": "running",
  "phase": "reviewing",
  "workspaceRoot": "D:\\project\\repo",
  "cwd": "D:\\project\\repo",
  "pid": 12345,
  "createdAt": "2026-05-13T10:00:00.000Z",
  "updatedAt": "2026-05-13T10:00:05.000Z",
  "completedAt": null,
  "target": {
    "mode": "working-tree",
    "label": "working tree diff",
    "baseRef": null,
    "explicit": false
  },
  "request": {
    "argv": ["--background"],
    "timeoutMinutes": 30,
    "json": false
  },
  "logFile": "C:\\Users\\...\\jobs\\review-lx2abc-4f9k2p.log",
  "result": null,
  "errorMessage": null
}
```

完成后：

```json
{
  "status": "completed",
  "phase": "completed",
  "pid": null,
  "completedAt": "2026-05-13T10:08:00.000Z",
  "result": {
    "exitCode": 0,
    "rawOutput": "...",
    "stderr": ""
  }
}
```

### 14.3 State 目录

优先使用 Codex 插件数据环境变量。需要实现者验证真实变量名。

候选：

- `CODEX_PLUGIN_DATA`
- `CODEX_HOME`
- 回退到 `os.tmpdir()/claude-review-plugin`

per-workspace state 路径规则：

```text
<state-root>/state/<workspace-basename>-<sha256-realpath-16>/
├── state.json
└── jobs/
    ├── <job-id>.json
    └── <job-id>.log
```

`state.json`：

```json
{
  "version": 1,
  "jobs": []
}
```

只保留最近 50 个 job。淘汰 job 时同步删除 job json 和 log。

### 14.4 后台启动

后台模式不要让 Codex 的 shell 会话一直挂住。

Node 实现：

```js
spawn(process.execPath, [scriptPath, "review-worker", "--cwd", cwd, "--job-id", job.id], {
  cwd,
  env: process.env,
  detached: true,
  stdio: "ignore",
  windowsHide: true
});
child.unref();
```

Windows 要点：

- `windowsHide: true`
- cancel 时使用进程树终止，不能只杀父进程。

### 14.5 日志

日志文件必须记录：

- job 创建
- 目标解析结果
- 上下文收集阶段
- 实际执行的安全摘要，不记录完整 prompt 中可能过大的内容
- Claude process pid
- stdout/stderr 结束状态
- cancel 事件

不要在日志中写入密钥、环境变量全集、用户 token。

## 15. 脚本模块职责

### 15.1 `claude-review.mjs`

唯一 CLI 入口。

子命令：

```text
setup
review
review-worker
status
result
cancel
help
```

职责：

- 解析子命令。
- 调用 lib。
- 统一错误处理。
- 统一 stdout/json 输出。

不应包含复杂业务逻辑。

### 15.2 `lib/args.mjs`

职责：

- 支持 raw argument string。
- 支持 boolean/value options。
- 支持 positionals。
- 保留未知参数时报错。

需要支持：

```js
parseArgs(["--base", "main", "--background"])
parseArgs(['--base main --background'])
```

### 15.3 `lib/process.mjs`

职责：

- `binaryAvailable(binary, args, options)`
- `runCommand(binary, args, options)`
- `runCommandChecked(binary, args, options)`
- `terminateProcessTree(pid)`

Windows 进程树终止可用：

```bash
taskkill /pid <pid> /t /f
```

注意不能把未验证用户输入拼接进 shell 字符串。用 `spawn` 参数数组。

### 15.4 `lib/git.mjs`

职责：

- `ensureGitRepository(cwd)`
- `getRepoRoot(cwd)`
- `getCurrentBranch(cwd)`
- `detectDefaultBranch(cwd)`
- `getWorkingTreeState(cwd)`
- `resolveReviewTarget(cwd, options)`
- `collectWorkingTreeContext(cwd, target, options)`
- `collectBranchFallbackContext(cwd, baseRef, options)`

### 15.5 `lib/claude.mjs`

职责：

- `getClaudeAvailability(cwd)`
- `getClaudeAuthStatus(cwd)`
- `runClaudePrintReview(cwd, prompt, options)`
- `runClaudeUltraReview(cwd, baseRef, options)`
- `getUltraReviewAvailability(cwd)`

超时处理：

- 默认 30 分钟。
- timeout 到期后终止进程树。
- job 标记 failed，错误信息为 timeout。

### 15.6 `lib/state.mjs`

职责：

- resolve state dir
- load/save state
- upsert/list jobs
- read/write job file
- prune old jobs
- generate job id

必须用原子写入或尽量安全写入：

- 写 `<file>.tmp`
- rename 到目标文件

### 15.7 `lib/tracked-jobs.mjs`

职责：

- 创建 job record
- 更新 phase
- append log
- run tracked foreground/background worker
- 捕获 stdout/stderr
- 保存结果

### 15.8 `lib/render.mjs`

职责：

- `renderSetupReport`
- `renderQueuedReview`
- `renderStatusReport`
- `renderSingleJobStatus`
- `renderStoredJobResult`
- `renderCancelReport`

输出风格：

- 结论在前。
- 简洁。
- review 结果本身尽量原样保留。

## 16. Skill 设计

`skills/claude-review/SKILL.md` 是 Codex 插件兼容入口。

触发描述：

```yaml
name: claude-review
description: Use when the user asks Codex to have Claude Code review local changes, branch diffs, pull requests, or asks for a second-model review from Claude.
```

技能正文要写清楚：

- 当用户明确要求 Claude review，先运行 setup 检查。
- 对普通 review，运行 `node <plugin-root>/scripts/claude-review.mjs review ...`。
- 如果用户要求后台，传 `--background`。
- 如果用户说 against main，传 `--base main`。
- review-only：不要自行修复 Claude 提到的问题。
- 返回脚本 stdout，不要改写 review 结果。

技能必须避免：

- 不要把 Codex 自己的 review 冒充 Claude review。
- 不要在 Claude review 前修改代码。
- 不要对 Claude 输出做二次“粉饰”导致事实变化。

## 17. Command 文件设计

如果 Codex 支持 command 文件，内容应仿照 `codex-plugin-cc`。

`commands/review.md` 逻辑：

- description：Run a read-only Claude Code review against local git state
- argument-hint：`[--wait|--background] [--base <ref>] [--scope auto|working-tree|branch]`
- allowed tools：只允许 shell/node/git 类只读或脚本调用。
- disable model invocation：如果 Codex 支持类似字段，应启用，让命令只执行脚本。

核心约束：

```text
This command is review-only.
Do not fix issues, apply patches, or suggest that you are about to make changes.
Your only job is to run the Claude review command and return its output.
```

前台：

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-review.mjs" review "$ARGUMENTS"
```

后台：

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-review.mjs" review --background "$ARGUMENTS"
```

由于 Codex 是否有 `CODEX_PLUGIN_ROOT` 和 `$ARGUMENTS` 变量需要验证，命令文件必须在实现时通过真实 Codex command runtime 校准。

## 18. 安全和权限

### 18.1 Review-only 保证

本插件默认只读。

Working tree review：

- 只运行 git 读命令。
- 只读取 untracked 文本文件。
- 调用 `claude -p` 时 prompt 明确禁止修改。

Branch review：

- 使用 `claude ultrareview`，其语义是 review。

不允许：

- 自动运行 `claude` interactive 并授权写入。
- 自动应用 patch。
- 自动执行 Claude 建议的命令。

### 18.2 用户数据

review 会把本地 diff 发送给 Claude Code 使用的后端。setup 和 README 必须说明：

```text
This plugin sends selected repository context to Claude Code through your local Claude CLI configuration.
Do not run it on code you are not allowed to share with Claude.
```

### 18.3 环境变量

不要记录完整环境变量。

允许记录：

- Node version
- Claude version
- Git version
- cwd
- workspace root

不记录：

- API key
- token
- cookie
- auth helper output

## 19. 错误处理

常见错误和输出：

Claude 不存在：

```text
Claude Code CLI is not installed or not on PATH.
Install Claude Code, then rerun /claude:setup.
```

Claude 未认证或不可调用：

```text
Claude Code is installed but could not complete a minimal non-interactive run.
Run `claude auth` or open Claude Code once, then rerun /claude:setup.
```

非 Git 仓库：

```text
This command must run inside a Git repository.
```

无内容可 review：

```text
No working-tree changes were found. Retry with --base <ref> to review a branch diff.
```

默认分支无法检测：

```text
Unable to detect the default branch. Pass --base <ref> or use --scope working-tree.
```

后台已有任务：

- 不阻止多个 review 并行，但 `status` 要能展示多个 running job。
- `cancel` 默认取消最近 running job。

Claude 超时：

```text
Claude review timed out after 30 minutes.
```

## 20. 输出格式

### 20.1 setup 输出

示例：

```text
Claude Review setup: ready

- Node: v22.x
- Git: git version ...
- Claude: 2.1.140 (Claude Code)
- Non-interactive Claude run: OK

Next:
- Run /claude:review --background
```

### 20.2 queued 输出

```text
Claude review started in the background as review-lx2abc-4f9k2p.
Check /claude:status review-lx2abc-4f9k2p for progress.
```

### 20.3 status 输出

```text
Claude Review jobs for D:\project\repo

Running:
- review-lx2abc-4f9k2p | working tree diff | reviewing | 2m 14s

Recent:
- review-lx29aa-a82kdm | branch diff against main | completed | 8m 03s
```

### 20.4 result 输出

前面可加简短 job 元信息，然后输出 Claude 原文：

```text
Claude Review result: review-lx29aa-a82kdm
Target: branch diff against main
Status: completed

<Claude review output>
```

如果是 `/claude:review` 前台结果，可直接输出 Claude review 原文，少加包装。

## 21. 测试方案

### 21.1 单元测试

使用 Node 内置 test runner：

```bash
node --test tests/*.test.mjs
```

测试范围：

- args 解析
- git target 解析
- default branch 检测
- dirty working tree 检测
- state 读写和 prune
- render 输出
- job 状态流转
- process timeout

### 21.2 Git fixture 测试

测试中创建临时 Git 仓库：

- init repo
- commit base
- 创建 staged 修改
- 创建 unstaged 修改
- 创建 untracked 文本文件
- 创建 untracked 二进制文件
- 创建 main/master/trunk 分支组合

验证：

- `--scope auto` dirty 时选 working-tree。
- `--scope auto` clean 时选 branch。
- `--base main` 选 branch。
- untracked 二进制被跳过。

### 21.3 Claude 调用测试

不要在普通单元测试中真实调用 Claude。

做法：

- 允许通过环境变量注入 fake Claude binary。
- fake binary 输出固定文本。
- fake ultrareview 模拟成功、失败、超时。

示例：

```text
CLAUDE_REVIEW_CLAUDE_BIN=<path-to-fixture>
```

### 21.4 端到端手动验收

在真实 Git repo 中：

```bash
node plugins/claude-review/scripts/claude-review.mjs setup
node plugins/claude-review/scripts/claude-review.mjs review --scope working-tree --wait
node plugins/claude-review/scripts/claude-review.mjs review --base main --wait
node plugins/claude-review/scripts/claude-review.mjs review --scope working-tree --background
node plugins/claude-review/scripts/claude-review.mjs status
node plugins/claude-review/scripts/claude-review.mjs result
node plugins/claude-review/scripts/claude-review.mjs cancel
```

Codex 插件验收：

- marketplace 可添加。
- 插件可安装。
- skill 可被触发。
- 如果 slash command 支持存在，`/claude:review` 可出现并运行。

## 22. 实现顺序

推荐顺序：

1. 初始化 repo：`package.json`、test runner、基本目录。
2. 创建 `.codex-plugin/plugin.json` 和 marketplace。
3. 实现 `args/process/fs/workspace/state/render` 基础模块。
4. 实现 `git` target 解析和 context 收集。
5. 实现 `claude` availability、print review、ultrareview 调用。
6. 实现 `claude-review.mjs setup/review` 前台模式。
7. 实现 job state、background worker、status/result/cancel。
8. 写 `skills/claude-review/SKILL.md`。
9. 验证 Codex 插件安装和 skill 触发。
10. 验证 slash command 能力；可用则接入 `commands/*.md`，不可用则记录限制。
11. 补 README 和用户安装说明。

不要先写 UI 或复杂 hook。核心 review 引擎稳定后再做入口增强。

## 23. README 应包含的内容

README 面向用户，不要写太多内部设计。

必须包含：

- 这是 Codex 插件，用本机 Claude Code CLI 做只读 review。
- 需要安装并登录 Claude Code。
- 安装 marketplace 的方式。
- setup 命令。
- review 命令示例。
- working-tree 和 branch/base review 区别。
- 后台任务 status/result/cancel。
- 数据会通过 Claude Code 发送给 Claude。
- 当前 slash command 支持状态。

如果 Codex 不能原生 slash command，README 应明确写：

```text
Codex plugin slash commands are not available in the tested Codex version.
Use the Claude Review skill prompt or run the companion script directly.
The command files are kept as a forward-compatible target.
```

## 24. 关键风险

### 24.1 Codex 插件 slash command 能力不确定

这是最大风险。

缓解：

- 不把核心能力绑死在 command 文件。
- 先做脚本和 skill。
- 保留 `commands/` 设计。
- 把真实支持情况写入 README。

### 24.2 `claude ultrareview` 不支持 working tree

缓解：

- branch/base 用 ultrareview。
- working-tree 用 `claude -p` + inline diff。

### 24.3 大 diff prompt 过大

缓解：

- 设置 diff 大小上限。
- MVP 超限时失败并给明确建议。
- 后续实现 self-collect 模式。

### 24.4 后台任务跨平台取消

缓解：

- Windows 使用 `taskkill /t /f`。
- Unix 使用 detached process group。
- 测试 fake long-running process。

### 24.5 Claude 输出不可结构化

缓解：

- MVP 保留原文。
- 不强依赖 JSON parse。
- 后续再加 schema。

## 25. 验收标准

MVP 完成标准：

- `setup` 能准确报告 Node/Git/Claude 可用性。
- `review --scope working-tree --wait` 能对 staged、unstaged、untracked 文本文件进行 Claude review。
- `review --base main --wait` 能调用 `claude ultrareview main`。
- `review --background` 能返回 job id。
- `status` 能显示 running/completed/failed/cancelled。
- `result` 能展示最近或指定 job 的 review 原文。
- `cancel` 能取消 running job，并更新状态。
- 所有核心模块有单元测试。
- README 写明安装和 slash command 支持状态。
- 如果 Codex 原生支持 slash command，则 `/claude:review` 等命令可用。
- 如果 Codex 原生不支持，skill 触发和脚本入口可用，且文档明确限制。

## 26. 给后续开发模型的提示

实现时请遵守：

- 先验证 Codex 插件 command 能力，不要假设存在。
- 核心逻辑写进 Node 脚本和 lib，不要写进 Markdown 命令文件。
- 先让脚本可测试，再接 Codex 插件入口。
- 所有 review 默认只读。
- 不要自动修复 Claude review 发现的问题。
- 不要记录敏感环境变量。
- Windows 路径和进程树取消必须实测。
- 每完成一个模块，运行最窄测试。

推荐第一条开发任务：

```text
Create the repo skeleton, manifest, marketplace, and a `setup` subcommand that verifies node/git/claude availability. Do not implement review yet.
```

