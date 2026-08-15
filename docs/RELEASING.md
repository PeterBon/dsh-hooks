# 发布与 CI 运维指南

dsh-hooks 的发布链路与安全 CI 的完整操作手册。写给维护者（也就是未来的自己）——每一步的「为什么」都来自真实踩坑记录。

## 一次完整发布（约 5 分钟）

```sh
# 1. 触发发布准备（在 main 上跑，自动：校验版本 → check → 推 release/vX.Y.Z 分支）
gh workflow run release.yml -f version=0.3.0

# 2. 等 workflow 完成（Actions → Prepare release），它会打印 PR 链接
# 3. 用「真人权限」创建 PR（Actions token 无权限建 PR，这是 GitHub 的硬限制）：
gh pr create --base main --head release/v0.3.0 --title "chore(release): v0.3.0" --body "..."

# 4. CI 双平台全绿后合并：
gh pr merge <pr-number> --squash --delete-branch

# 5. 打 tag 并推送 —— publish.yml 自动接管剩余全部工作：
git pull --ff-only
git tag v0.3.0
git push origin v0.3.0
```

tag 推送后 `publish.yml` 自动完成：

1. `pnpm run check`（发布前的完整门禁）
2. 创建 GitHub Release（幂等：已存在则跳过）
3. `npm publish --provenance`（幂等：版本已在 npm 则跳过）

**无需任何 token**：npm 发布走 Trusted Publishing（OIDC），GitHub Release 走 `GITHUB_TOKEN`。

## 发布链路的安全设计

| 层 | 内容 |
| --- | --- |
| 身份 | npm Trusted Publishing：GitHub 仓库 + workflow 绑定为可信发布方，无长期凭据、无 90 天过期 |
| 溯源 | 每个版本带 Sigstore provenance 签名（可在 npm 包页 Versions 标签查看） |
| npm 策略 | 包已启用「Require two-factor authentication and disallow bypass 2fa tokens」——token 泄漏也无法发布 |
| 幂等 | Release 与 npm 发布步骤均可安全重跑（重打 tag / 补发场景） |
| 权限 | publish.yml 显式声明 `contents: write` + `id-token: write`（job 级），无多余权限 |

### 如果将来需要重新配置 Trusted Publishing

npm 包页 → Settings → Trusted Publishing → Add：

| 字段 | 值 |
| --- | --- |
| Organization or user | `PeterBon` |
| Repository | `dsh-hooks` |
| Workflow filename | `publish.yml`（只要文件名） |
| Allowed actions | `npm publish` |
| Environment | 留空 |

配置后发布无需任何 secret；旧的 `NPM_TOKEN` secret 已删除。

## 踩坑记录（改 workflow 前先读这里）

1. **`id-token: write` 必须声明在 job 级**——只有顶层声明时，runner 不会注入
   `ACTIONS_ID_TOKEN_*` 环境变量，npm 静默回退为 `ENEEDAUTH`。
2. **`setup-node` 的 `registry-url` 会写空 `_authToken` 行**进用户 `.npmrc`，
   npm 视为「已配置认证」而不再尝试 OIDC → 又是 `ENEEDAUTH`。publish 流程
   不要用 `registry-url`，token 回退分支里显式 `npm config set`。
3. **Node 22 自带 npm 10，没有自动 GitHub OIDC 交换**（那是 npm 11 的功能）；
   npm 10 的 `SIGSTORE_ID_TOKEN` 只负责签名、不负责注册表认证。因此
   publish.yml 发布前先 `npm install -g npm@11`。
4. **删除后重推 tag 会把对应 Release 改名成 `untagged-…`**，且标签页残留
   草稿状态。遇到后用 `gh release edit <tag> --draft=false` / 重建 Release 修复。
   因为发布步骤幂等，重打 tag 是安全的，但别把 tag 删来删去。
5. **pnpm 11 不再读取 `package.json` 的 `pnpm.overrides`**——依赖强制版本
   必须写在 `pnpm-workspace.yaml` 的 `overrides:`。
6. **发布步骤必须幂等**：`gh release create` 对已存在的 Release 直接失败，
   `npm publish` 对已存在的版本直接失败——两者都先探测再执行。

## 安全 CI 三件套

| 组件 | 位置 | 行为 |
| --- | --- | --- |
| 依赖门禁 | `ci.yml` 的 `pnpm audit --audit-level=high` | high/critical 公告即红 |
| CodeQL | `.github/workflows/codeql.yml` | PR + 每周定时；TS/JS 污点分析（本项目执行 shell 命令，是重点扫描对象） |
| Dependabot | `.github/dependabot.yml` | npm + Actions 每周升级 PR，与 audit 门禁形成「挡住→升级→修复」闭环 |

- CodeQL 告警：仓库 **Security → Code scanning**；误报可在 UI 关闭对应规则
- Dependabot 升级 PR 走完整 CI，正常 squash 合并即可

## 本地环境注意

- **本机 npm 源是 npmmirror（淘宝镜像）**：不支持 `pnpm audit`，且新版本同步滞后
  （发布后本机 `npm view` 可能还显示旧版本）。本地验证漏洞用：
  `pnpm audit --audit-level=high --registry=https://registry.npmjs.org`
  （CI 用官方源，不受影响）
- 提交前门禁：`pnpm run check`（typecheck + typecheck:test + vitest + build）
- `lib/` 必须随构建产物提交（git-hosted 安装不构建），CI 有 `git diff --exit-code -- lib` 守护
- git 推送如遇沙箱管道限制（signal pipe 错误），可用
  `git -c credential.helper= -c http.extraheader="AUTHORIZATION: basic <b64>" push https://github.com/PeterBon/dsh-hooks.git <ref>`
  方式（Actions 同款认证头，token 不进 URL 不落盘）
