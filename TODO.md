# TODO

## 代码审查后续（2026-05-27）

- [x] 根据 `docs/review-2026-05-27-codex-readiness.md` 修正文档与事实不一致问题
- [x] 修复手动安装链路，确保 `enable/install/doctor` 真正闭环
- [ ] 统一 `doctor` 与插件脚本 `setup` 的环境检查逻辑
- [x] 修复 Windows 下 `cancel` 任务后的进程/句柄释放问题
- [ ] 把 `--json` 收敛为稳定输出契约，并接入 schema 校验
- [x] 修正 direct API fallback 的安全边界说明与默认行为
- [x] 同步 `package.json` 与插件 manifest 的版本号
- [ ] 评估并优化 working tree / branch review 的上下文收集性能

## 待完成：发布到 npm

**状态**: 进行中
**日期**: 2026-05-26

### 已完成
- [x] 注册 npm 账号（用户名: yuzhouzhou）
- [x] 改造项目支持 npm 发布（添加 bin 命令、enable、doctor）
- [x] 更新 README 文档
- [x] 切换 npm registry 到官方
- [x] 登录 npm

### 待完成
- [ ] 设置 npm 两步验证（邮箱验证或 Authenticator App）
- [ ] 执行 `npm publish --otp=<code>` 发布
- [ ] 发布后验证：`npm install -g codex-claude-review`
- [ ] 切换回淘宝镜像：`npm config set registry https://registry.npmmirror.com`

### 发布命令
```bash
# 登录（如需重新登录）
npm login

# 发布（需要 OTP 验证码）
npm publish --otp=<code>

# 验证安装
npm install -g codex-claude-review
claude-review doctor
```

### npm 账号信息
- 用户名: yuzhouzhou
- 邮箱: (用户自己的邮箱)
- 包名: codex-claude-review
- 当前版本: 0.1.0
