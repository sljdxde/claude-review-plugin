# codex-plugin-cc 对标与改进方案（2026-05-28）

## 当前结论

`openai/codex-plugin-cc` 已在本机 Claude Code 中安装并启用：

- marketplace: `openai-codex`
- plugin: `codex@openai-codex`
- installed version: `1.0.4`
- setup check: ready

本库 `codex-claude-review` 的定位是“让 Codex 调用 Claude Code 做审查”，不应照搬 `codex-plugin-cc` 的完整任务代理能力。推荐吸收 review 链路里能提升可靠性、可解释性、可维护性的部分。

## codex-plugin-cc 具备而本库缺少的能力

1. **adversarial-review**
   - `codex-plugin-cc` 提供专门的对抗式审查入口，用于挑战实现方向、设计假设和取舍。
   - 本库当前只有普通 review。

2. **rescue / task delegation**
   - `codex-plugin-cc` 可以把调查、修复、续跑任务委托给 Codex subagent，并支持 resume/fresh、model、effort、write/read-only。
   - 本库是 review-only 插件，不建议直接加入写代码任务代理，否则会破坏只读定位。

3. **review gate**
   - `codex-plugin-cc` 有可选 Stop hook，在 Claude Code 停止前要求新鲜 Codex review。
   - 本库当前没有类似 gate。

4. **更丰富的 job 状态模型**
   - `codex-plugin-cc` 的 status/result/cancel 能围绕 job class、phase、elapsed、summary、session 可见性提供更完整状态。
   - 本库当前状态输出较简单。

5. **更严格的 review 输出契约**
   - `codex-plugin-cc` 的 schema 要求 `verdict`、`summary`、`findings`、`next_steps`，finding 字段也更完整。
   - 本库已有 schema 文件，但约束宽松，`--json` 仍是 best-effort。

## 本轮已落地的改进

1. **安装与事实核对**
   - 验证 `codex-plugin-cc` 已安装、启用、setup ready。

2. **Direct API fallback 顺序修正**
   - `runClaudePrintReview` 改为先走 Claude CLI。
   - 只有 CLI 失败或空输出时，才使用 Direct API fallback。
   - `CLAUDE_REVIEW_FORCE_CLAUDE_CLI=1` 会完全禁用 fallback。

3. **Windows cancel 稳定性**
   - 后台 worker 不再以被审查仓库作为进程 cwd。
   - Windows `taskkill` 后等待进程树退出，降低临时目录 `EBUSY` 风险。
   - 放宽 Windows 后台任务测试等待窗口，避免慢启动导致误判。

4. **README 图片与安全表述**
   - 英文 README 引入 E1/E2/E3。
   - 中文 README 引入 C1/C2/C3。
   - 工作原理图旁补充 Direct API fallback 边界说明。

## 建议后续改进顺序

### P1: 输出契约

把 `--json` 从 best-effort 收敛成稳定契约：

- 扩展 schema 到 `verdict`、`summary`、`findings`、`next_steps`。
- working-tree prompt 明确要求 JSON。
- branch fallback 路径不要在 JSON 前拼接说明文本。
- JSON 解析失败时返回结构化错误，而不是混入 raw text。

### P2: 状态与诊断

吸收 `codex-plugin-cc` 的 job 状态思路，但保持 review-only：

- `status --json` 增加 elapsed/duration、summary、lastLogLine。
- `result --json` 保留完整 rawOutput、parsedJson、parseError。
- `doctor/setup` 统一检查逻辑，避免两套路由漂移。

### P3: 可选对抗式审查

新增 review-only 的 `adversarial-review`：

- 不做任务代理，不写代码。
- 复用现有 working-tree / branch context。
- 使用单独 prompt 强调设计假设、错误边界、维护风险。

### 暂不建议做

- 不把 `rescue/task --write` 迁入本库。
- 不引入 Stop hook review gate，除非后续明确要把本库变成 Claude Code 侧的强制审查插件。
