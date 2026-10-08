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

npm 侧会先回一句「being processed and may take a few minutes to become available」——本机 npm
源是 npmmirror，必须查官方源才能确认落地：
`npm view dsh-hooks@<版本> version --registry=https://registry.npmjs.org`。

发布本身不等于「本机在跑新版」：profile 里的依赖和 `compatibility.json` 的版本豁免都要单独收尾，
见「踩坑记录」第 8、9 条。

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
7. **连续合并多个 Dependabot 锁文件 PR 会产生「重复映射键」**（已复发两次：
   #104+#105 → #107 修；#111+#109 → 本次修）。每个分支各自基于旧 base
   重生成锁文件，GitHub 的文本合并会把同一个包条目插进 `packages:` /
   `snapshots:` 两次，pnpm 报 `duplicated mapping key`
   （CI 报 `ERR_PNPM_BROKEN_LOCKFILE`）。合并后必查：

   ```sh
   node -e "require('yaml').parse(require('fs').readFileSync('pnpm-lock.yaml','utf8'))" \
     && echo OK   # 严格解析：有重复键就抛 Map keys must be unique
   ```

   修复只删重复条目，再用 `pnpm install --lockfile-only` 验证输出字节不变
   （证明仍是 pnpm 规范输出）。更稳妥的做法：Dependabot PR 合并前先
   `@dependabot rebase`，让分支基于当前 main 重生成锁文件再合。

8. **dsh 升大版本时，插件必须同步改 `peerDependencies` 的宿主下限，否则会被静默禁用**。
   宿主只检查 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 这几条 peer
   （`dsh-app-boot` 的 `evaluatePluginCompatibility`，semver 带 `includePrerelease`），
   而 `^0.1.0-rc.6` 这类范围反解出的上界是 `0.2.0-0` → 在 0.2 运行时上判 false：
   preflight 会把该插件行置 `disabled`，只在启动 stderr 留一行，**服务器本身照样健康**
   （所以只看 `/degraded` 会发现不了）。改之前只能靠 `compatibility.json` 的精确豁免硬撑。
   预发布版本要写足：`^0.2.0-rc.2` 通过，`^0.2.0` 同样 false。
   只有 `peerDependencies` 参与判定，`dsh.engines.dsh` 不参与。
   顺带核对客户端半边：0.2 删掉了 `@deepseek-ai/dsh-client-runtime`（`ClientContext` 改从
   `@deepseek-ai/cordis` 导入），`ctx.slots` 的类型声明改由
   `@deepseek-ai/dsh-client-ui-renderer/client` 提供，`dsh.client.inject` 也要跟着列真实存在的
   客户端模块。（实例：dsh-hooks 0.13.1 → 0.14.0，PR #118。）

9. **发版之后还有一步：把本机 profile 的插件升上去，并删掉已经过期的豁免**。
   `compatibility.json` 里的豁免是 `"<包>@<版本>"` 精确匹配，新版装上去后旧条目就是死数据，
   应直接删掉该文件并断言 `dsh plugin --profile web version-exemptions` 输出 `{}`。
   升级脚本照 `~/.dsh/profiles/web/upgrade-hooks-0.14.0-20261008.ps1` 的模式写：
   60s 延迟让当轮对话先送达 → 停 3080 → `pnpm add <包>@X.Y.Z --save-exact` → 删豁免 →
   启动后三探针（`/api/dsh-web-all/degraded` 为空、`/dsh-hooks/status` 的 `version` 与
   `hookCount` 都对、启动 stderr 无 `disabling profile plugin`）→ 任一不过就回滚到旧版+旧豁免。
   它要重启 dsh web（即当前会话所在进程），所以用 `schtasks /create … /run` 脱离当前进程启动。

## 安全 CI 三件套

| 组件 | 位置 | 行为 |
| --- | --- | --- |
| 依赖门禁 | `ci.yml` 的 `pnpm audit --audit-level=high` | high/critical 公告即红 |
| CodeQL | `.github/workflows/codeql.yml` | PR + 每周定时；TS/JS 污点分析（本项目执行 shell 命令，是重点扫描对象） |
| Dependabot | `.github/dependabot.yml` | npm + Actions 每周升级 PR，与 audit 门禁形成「挡住→升级→修复」闭环 |

- CodeQL 告警：仓库 **Security → Code scanning**；误报可在 UI 关闭对应规则
- Dependabot 升级 PR 走完整 CI，正常 squash 合并即可；但**依赖类 PR 一次只合一个**，
  每个合完跑一次锁文件严格解析（见「踩坑记录」第 7 条），否则会出现重复映射键把 main CI 打红

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
