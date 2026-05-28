# Claude Review 插件审查记录（2026-05-27）

## 1. 审查范围

- 仓库结构
- `README.md` / `README_CN.md`
- Codex 插件 manifest、skill、commands
- CLI 入口与核心脚本
- 测试覆盖与当前可执行结果

## 2. 结论

### 2.1 是否可在 Codex 中使用

结论：可以进入“可试用”状态，但还不适合按当前 README 的表述直接对外承诺“开箱即用”。

判断依据：

- 插件目录结构与当前 Codex 本地插件缓存结构基本一致。
- `.agents/plugins/marketplace.json`、`plugins/claude-review/.codex-plugin/plugin.json`、`skills/`、`commands/` 已具备基本插件形态。
- 本机 Codex 配置中已经存在 `claude-review@local-codex-plugins` 的启用项，且本机缓存里存在该插件副本。

限制：

- 手动安装链路不完整。
- README 的部分能力与实现不一致。
- Windows 下 `cancel` 相关测试未稳定通过。

### 2.2 README 是否都能实现

结论：不能。

当前 README 中至少有以下几类内容与实现存在偏差：

- 安装链路描述不完整。
- 安全说明与 direct API fallback 的真实行为冲突。
- `--json` 选项更接近“尽量返回 JSON”，不是稳定的结构化输出。
- “后台任务可取消”在 Windows 上存在资源释放问题。

## 3. 已验证事实

### 3.1 已阅读内容

- `package.json`
- `README.md`
- `README_CN.md`
- `bin/claude-review.mjs`
- `plugins/claude-review/.codex-plugin/plugin.json`
- `plugins/claude-review/skills/claude-review/SKILL.md`
- `plugins/claude-review/commands/*.md`
- `plugins/claude-review/scripts/**/*.mjs`
- `tests/*.test.mjs`

### 3.2 已执行验证

- `npm.cmd test`
  - 结果：27 个测试里 26 通过，1 失败。
  - 失败项：`cancel marks a running background review as cancelled`
- `node --test tests/commands.test.mjs`
  - 结果：5 个测试里 4 通过，1 失败。
  - 同一失败项稳定复现。

### 3.3 当前工作区状态

- 审查时未修改业务代码。
- `git status --short` 仅看到未跟踪文件 `TODO.md`。

## 4. 主要问题

### 4.1 P1: README 的安全表述与实现冲突

现象：

- README 宣称分析“全部在本地进行”“不会上传数据”。
- 实现中存在 direct API fallback，会将 prompt / diff 发送到远程 `/v1/messages` 接口。

影响：

- 这是信任边界问题，不是普通文案偏差。
- 如果对外发布而不修正，用户会对数据流向产生错误判断。

涉及位置：

- `README.md`
- `plugins/claude-review/scripts/lib/claude.mjs`

### 4.2 P1: 手动安装路径不闭环

现象：

- README 将 `npm install -g` + `claude-review enable` + `claude-review doctor` 描述为手动安装方式。
- 实际 `enable` 只是在 `~/.codex/config.toml` 中追加插件启用配置。
- `enable` 本身不负责注册 marketplace，也不负责确保插件源可被 Codex 发现。

影响：

- 在干净环境中，用户可能“已启用”但实际无法被 Codex 正常发现或加载。
- `doctor` 也可能因为只检查配置字符串而给出错误信号。

涉及位置：

- `README.md`
- `bin/claude-review.mjs`
- `.agents/plugins/marketplace.json`
- `docs/claude-review-plugin-design.md`

### 4.3 P2: `--json` 能力未真正闭环

现象：

- 仓库中已有 `review-output.schema.json`。
- 但 working-tree review 主路径默认走纯文本 prompt。
- branch fallback 路径还会手动在输出前拼接说明文本。
- 最终只是在少数场景下尝试 `JSON.parse`，失败则回退为 `rawOutput`。

影响：

- 无法把 `--json` 当作稳定接口使用。
- 后续若要接 CI、脚本或 UI，输出契约不可靠。

涉及位置：

- `README.md`
- `plugins/claude-review/scripts/claude-review.mjs`
- `plugins/claude-review/schemas/review-output.schema.json`

### 4.4 P2: Windows 下 `cancel` 流程存在资源回收问题

现象：

- `cancel` 相关测试稳定失败。
- 报错表现为临时目录删除时 `EBUSY: resource busy or locked`。

影响：

- 说明状态写成 `cancelled` 后，并不代表 worker / 子进程 / 句柄一定已经完全退出。
- 对真实用户而言，可能表现为任务残留、日志句柄未释放或目录无法及时清理。

涉及位置：

- `tests/commands.test.mjs`
- `plugins/claude-review/scripts/claude-review.mjs`
- `plugins/claude-review/scripts/lib/process.mjs`

### 4.5 P2: `enable` / `doctor` 的启用判断过于粗糙

现象：

- 目前是通过字符串包含关系判断 `claude-review@local-codex-plugins` 是否已启用。

影响：

- 不能区分：
  - 仅存在配置块但 `enabled = false`
  - 注释中出现该字符串
  - 插件启用但 marketplace 未正确安装

涉及位置：

- `bin/claude-review.mjs`

### 4.6 P3: 版本信息漂移

现象：

- `package.json` 版本是 `0.1.1`
- 插件 manifest 版本仍是 `0.1.0`

影响：

- 容易导致缓存、升级、排障时的认知混乱。

涉及位置：

- `package.json`
- `plugins/claude-review/.codex-plugin/plugin.json`

## 5. 可优化点

### 5.1 功能层面

- 把安装做成真正的一步闭环，而不是只写启用配置。
- 合并 `doctor` 与插件脚本中的 `setup`，避免两套环境检查逻辑长期漂移。
- 明确区分“本地 CLI 模式”和“远程 API fallback 模式”的安全边界。
- 让 `--json` 成为稳定契约，而不是 best effort。
- 增加对“无 findings”场景的统一结构化输出。

### 5.2 性能与可扩展性层面

- `git status`、`git diff`、`ls-files` 可并行收集，减少等待时间。
- 大 diff 当前是超过阈值就失败，后续可考虑分批 review 或按文件裁剪。
- 对 `resolveClaudeCommand()`、`ultrareview --help` 这类探测结果做进程内缓存。
- untracked 文件超过上限时应显式报告 omitted 数量，而不是静默截断。
- job 状态文件写入策略可以继续收敛，降低未来并发任务下的竞态风险。

## 6. 建议的修复顺序

### 第一阶段：先修“文档与事实不一致”

- 安全说明
- 安装说明
- `--json` 说明

### 第二阶段：修“可用性阻塞项”

- Windows `cancel`
- 安装链路闭环
- `doctor/setup` 统一

### 第三阶段：修“体验与性能”

- 并行化上下文采集
- 大 diff 策略
- 输出契约与缓存优化

## 7. 后续原则

在完成上述问题修复前，不应把当前 README 视为对外能力承诺。

后续修复应遵循：

- 先修事实错误，再修体验问题。
- 先统一行为定义，再做性能优化。
- 每修一个问题，都补对应自动化测试或回归验证。
