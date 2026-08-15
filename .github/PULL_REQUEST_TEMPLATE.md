## 变更说明

<!-- 这个 PR 解决什么问题 / 做了什么，一句话到一小段。 -->

## 自查清单

- [ ] `pnpm run check` 全绿（typecheck + typecheck:test + vitest + build）
- [ ] `lib/` 已随构建产物同步提交（git-hosted 安装不跑构建）
- [ ] notify 相关测试未读取本机真实 feishu-config.json（显式传不存在的 configPath）
- [ ] 未提交任何凭据（feishu-config.json / app_secret / token）
- [ ] 提交信息符合 Conventional Commits
- [ ] 环境变量 / 上下文契约有变更时，README.md 与 README.zh.md 已同步
