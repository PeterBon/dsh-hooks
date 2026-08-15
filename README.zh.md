# dsh-hooks

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）的配置驱动生命周期 hooks 插件。

直接在 profile 的 `cordis.patch.yml` 里声明「事件 → 命令」——就像 Codex CLI / OpenCode 的 hooks，但属于 dsh。不需要写插件代码。

[English](README.md) | [设计](#设计) | [飞书示例](examples/notify-feishu.mjs)

## 安装

```sh
dsh plugin --profile web add dsh-hooks           # 从 npm 安装
# 或直接从 git 安装：
dsh plugin --profile web add github:PeterBon/dsh-hooks
```

重启 `dsh web` 生效。

## 配置

在你的 profile 的 `cordis.patch.yml` 里添加配置块：

```yaml
- id: dsh-hooks
  name: dsh-hooks
  config:
    hooks:
      - on: 'turn/end'
        when: 'completed'            # 可选：只在回合正常完成时触发
        run: 'node examples/notify-feishu.mjs'
        timeoutMs: 10000             # 可选，默认 10000
      - on: 'approval/asked'
        run: 'powershell -Command "Add-Content hooks.log approval-requested"'
```

## 事件（v1）

| 事件 | 触发时机 | 有用上下文 |
| --- | --- | --- |
| `turn/start` | 回合开始 | 会话 id、回合号 |
| `turn/end` | 回合结束（`completed` / `error` / `aborted` / `blocked` / `max-tokens` / `interrupted`） | reason、回合号、耗时 |
| `approval/asked` | 工具调用请求用户审批 | 工具名、调用 id、原因 |
| `agent/created` | Agent 发布 | 会话 id |
| `agent/disposed` | Agent 离开注册表 | 会话 id |
| `agent/error` | Agent 循环报错 | 错误文本 |
| `agent/status` | Agent 状态切换 | 状态 |

`turn/end` 的 `when` 匹配结束原因（`completed`、`error`…）；其他事件的 hook 无条件执行。

## 命令执行

- 每个命中的 hook 通过系统 shell 执行 `run`，**fire-and-forget**：失败只 `console.warn`，绝不重试、绝不阻塞 agent 循环。
- 上下文通过**环境变量**传递（数据不拼接进 shell 字符串，防注入）：

| 变量 | 含义 |
| --- | --- |
| `DSH_HOOK_EVENT` | 事件类型，如 `turn/end` |
| `DSH_HOOK_SESSION_ID` | 会话 id |
| `DSH_HOOK_SESSION_NAME` | 会话可读标题（最新 `session/title` 日志事件，或首个用户消息回退） |
| `DSH_HOOK_TURN` | 回合号（回合事件） |
| `DSH_HOOK_REASON` | 回合结束原因 |
| `DSH_HOOK_TOOL` | 工具名（审批事件） |
| `DSH_HOOK_CALL_ID` | 工具调用 id（审批事件） |
| `DSH_HOOK_DURATION_MS` | 回合耗时毫秒（turn/end） |
| `DSH_HOOK_STATUS` | Agent 状态（agent/status） |
| `DSH_HOOK_ERROR` | 错误文本（agent/error，以及 turn/end 出错时的失败详情） |
| `DSH_HOOK_CONTENT` | 该回合最后一段助手回复文本（回合事件） |
| `DSH_HOOK_TIMESTAMP` | ISO 时间戳 |

- `run` 里的 `{{变量}}` 占位符会从同一上下文替换，例如 `run: 'echo {{DSH_HOOK_SESSION_ID}} >> log.txt'`。

## 飞书通知示例

最快的方式是一步到位的 setup CLI——扫码自动创建飞书应用并写好全部 hook 配置：

```sh
dsh-hooks feishu-setup                 # 默认 profile：web
dsh-hooks feishu-setup --profile work  # 指定其他 profile
dsh-hooks feishu-test                  # 用已存凭据发送测试卡片验证
```

`feishu-setup` 会打印二维码（并在浏览器中打开），等你用飞书扫码后，自动创建名为「DSH 通知机器人」的应用（带消息发送权限），并写入：

| 文件 | 用途 |
| --- | --- |
| `~/.dsh/dsh-hooks/feishu-config.json` | app id/secret 与你的 open_id（通知目标），权限 0600，严禁提交；`result_max_chars` 控制卡片内容截断长度（默认 300） |
| `~/.dsh/dsh-hooks/notify-feishu.mjs` | hook 引用的通知脚本稳定副本 |
| `~/.dsh/profiles/<profile>/cordis.patch.yml` | dsh-hooks 配置块：`turn/end`（completed/error/aborted）+ `approval/asked` + `agent/error` 卡片 hook |

完成后重启 `dsh web`——回合结束、请求审批、agent 出错时就会收到卡片通知。

### 手动配置

想自己接线？见 [`examples/notify-feishu.mjs`](examples/notify-feishu.mjs)——零依赖脚本，通过飞书**应用 API**（不需要群自定义机器人）发送回合完成 / 审批通知。配置示例：

```yaml
- id: dsh-hooks
  name: dsh-hooks
  config:
    hooks:
      - on: 'turn/end'
        when: 'completed'
        run: 'node D:/path/to/examples/notify-feishu.mjs'
      - on: 'approval/asked'
        run: 'node D:/path/to/examples/notify-feishu.mjs --approval'
```

同时在 dsh 进程环境中提供 `DSH_HOOKS_FEISHU_APP_ID` / `DSH_HOOKS_FEISHU_APP_SECRET` / `DSH_HOOKS_FEISHU_TO`（绝不能写进配置文件）。

## 安全

Hook 会以 dsh 进程的权限执行任意命令，只配置你信任的命令。Secret 放环境变量或 dsh 凭据存储——永远不要写进 `cordis.patch.yml`。

## 设计

遵循 dsh 插件约定：`dsh.bundle.patch` 挂载插件行；插件监听持久 `session/event` firehose 与 agent 生命周期事件；发射是不可逆副作用，补偿而非阻塞（失败仅警告、绝不重试）。

## 开发

```sh
pnpm install
pnpm run check     # typecheck + test + build
```

发布与 CI 运维（Trusted Publishing、安全扫描、踩坑记录）：见 [docs/RELEASING.md](docs/RELEASING.md)。

## License

MIT
