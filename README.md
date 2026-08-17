# dsh-hooks

Config-driven lifecycle hooks plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).

Declare `event -> command` hooks directly in your profile's `cordis.patch.yml` — like Codex CLI / OpenCode hooks, but for dsh. No plugin code required.

[中文文档](README.zh.md) | [Design](#design) | [Feishu example](examples/notify-feishu.mjs) | [Web GUI 面板](packages/dsh-hooks-ui/README.md)

## Install

```sh
dsh plugin --profile web add dsh-hooks           # core: hook engine, history, dry-run
# or straight from git:
dsh plugin --profile web add github:PeterBon/dsh-hooks

# Optional Web GUI: a "Hooks" section in Settings (history timeline + manual
# tester). Install separately — the core works standalone without it.
dsh plugin --profile web add dsh-hooks-ui
```

Restart `dsh web`.

## Configure

Add a config block to your profile's `cordis.patch.yml`:

```yaml
- id: dsh-hooks
  name: dsh-hooks
  config:
    hooks:
      - on: 'turn/end'
        when: 'completed'            # optional: only completed turns
        run: 'node examples/notify-feishu.mjs'
        timeoutMs: 10000             # optional, default 10000
      - on: 'approval/asked'
        run: 'powershell -Command "Write-Output approval-requested >> hooks.log"'
      - on: 'tool/call'
        match:                       # optional: field → regex, all must match
          tool: '^(rm|git|ssh)'
        run: 'node examples/notify-webhook.mjs --slack'
      - on: 'turn/end'
        when: 'completed'
        run: 'node examples/notify-feishu.mjs'
        retries: 2                   # optional: retry non-zero exits (default 0)
        retryDelayMs: 1000           # optional: base retry delay, doubles (default 500)
      - on: 'turn/end'
        input: 'stdin'               # optional: write the full context JSON to stdin
        run: 'node my-hook.mjs'
      - on: 'approval/asked'
        notify:                      # built-in notification: instead of run, no script needed
          channel: 'desktop'         # platform balloon/toast
      - on: 'turn/end'
        when: 'completed'
        notify:
          channel: 'webhook'         # POST JSON to any HTTP endpoint
          url: 'https://hooks.slack.com/services/…'
          slack: true                # optional: { text } one-line summary (Slack style)
```

Every hook field:

| Field | Meaning | Default |
| --- | --- | --- |
| `on` | triggering event (see the event table) | required |
| `when` | filter `turn/end` by end reason | all reasons |
| `match` | field → regex, all must match; fields are context keys (`tool` / `sessionName` / `sessionId` / `error` / `source` / `cwd` / `content` / `reason`, …), a field absent from the context never matches | no filter |
| `run` | command spawned through the platform shell (exactly one of `run` / `notify`) | one of the two required |
| `notify` | built-in notification (exactly one of `run` / `notify`): `channel: webhook` (HTTP JSON; omit `url` to use `DSH_HOOKS_WEBHOOK_URL`, `slack: true` for a one-line summary) or `channel: desktop` (platform balloon/toast) | one of the two required |
| `input` | `env` passes only the `DSH_HOOK_*` variables; `stdin` additionally writes the full context JSON to the command's stdin | `env` |
| `timeoutMs` | per-run timeout (ms); the process tree is terminated on expiry | 10000 |
| `retries` | retry count for non-zero exit codes (spawn failures and timeouts never retry) | 0 |
| `retryDelayMs` | base delay between retries (ms), doubles per attempt | 500 |

## Events (v1)

| Event | When it fires | Useful context |
| --- | --- | --- |
| `turn/start` | A turn begins | session id, turn |
| `turn/end` | A turn ends (`completed` / `error` / `aborted` / `blocked` / `max-tokens` / `interrupted`) | reason, turn, duration, content, turn token usage |
| `step/end` | One step of a turn ends (one model call plus its tool executions) | turn, step |
| `tool/call` | The model requests one tool invocation | tool name, call id, raw arguments JSON |
| `tool/result` | A tool call completes | tool name (resolved), result text, failure identity |
| `user/message` | A user-role message appears on the surface | source kind (`user` / `plugin` / …), message text |
| `approval/asked` | A tool call requests user approval | tool name, call id, reason |
| `session/title` | The session title updates (explicit rename / LLM title / fallback) | new title, source kind |
| `session/created` | A session is published | session id, cwd |
| `session/disposed` | A session leaves the registry | session id, cwd |
| `agent/created` | An agent is published | session id |
| `agent/disposed` | An agent leaves the registry | session id |
| `agent/error` | The agent loop reports an error | error text |
| `agent/status` | Agent status transition | status |

The `when` filter for `turn/end` matches the `reason.kind` value (`completed`, `error`, …). Hooks for other events run unconditionally.

## Command execution

- Each matching hook spawns `run` through the platform shell, **fire-and-forget**: failures only `console.warn`, never retried by default (`retries` opts into background retries of non-zero exits), never block the agent loop. Command stdout/stderr is captured (64 KiB per stream); on a non-zero exit the stderr tail is appended to the warning log.
- Context is passed via **environment variables** (no shell injection through data):

| Variable | Meaning |
| --- | --- |
| `DSH_HOOK_EVENT` | event type, e.g. `turn/end` |
| `DSH_HOOK_SESSION_ID` | session id |
| `DSH_HOOK_SESSION_NAME` | readable session title (latest `session/title` log event, or first human prompt) |
| `DSH_HOOK_CWD` | session working directory |
| `DSH_HOOK_TURN` | turn number (turn / step / tool events) |
| `DSH_HOOK_STEP` | step number (step / tool events) |
| `DSH_HOOK_REASON` | turn end reason kind |
| `DSH_HOOK_TOOL` | tool name (approval / tool events) |
| `DSH_HOOK_CALL_ID` | tool call id (approval / tool events) |
| `DSH_HOOK_TOOL_ARGS` | raw tool arguments JSON (tool/call) |
| `DSH_HOOK_TOOL_ERROR` | tool failure identity `name: code` (tool/result errors) |
| `DSH_HOOK_SOURCE` | message / title source kind (`user`, `plugin`, `fallback`, `provider`, …) |
| `DSH_HOOK_DURATION_MS` | turn duration ms (turn/end) |
| `DSH_HOOK_STATUS` | agent status (`agent/status`) |
| `DSH_HOOK_ERROR` | error text (`agent/error`, and the failure message on `turn/end` error) |
| `DSH_HOOK_CONTENT` | event content snapshot: turn assistant text, tool result text, user message text |
| `DSH_HOOK_USAGE_INPUT_TOKENS` | aggregated input tokens of the turn (turn/end, summed across steps) |
| `DSH_HOOK_USAGE_OUTPUT_TOKENS` | aggregated output tokens of the turn |
| `DSH_HOOK_USAGE_CACHE_READ_TOKENS` | aggregated cache-read tokens, when reported |
| `DSH_HOOK_USAGE_CACHE_WRITE_TOKENS` | aggregated cache-write tokens, when reported |
| `DSH_HOOK_USAGE_REASONING_TOKENS` | aggregated reasoning tokens, when reported |
| `DSH_HOOK_TIMESTAMP` | ISO timestamp |

- `{{var}}` placeholders inside `run` are substituted from the same context, e.g. `run: 'echo {{DSH_HOOK_SESSION_ID}} >> log.txt'`.

## Generic webhook example

Besides Feishu, `examples/notify-webhook.mjs` posts the full hook context as one JSON document to any HTTP endpoint — Slack incoming webhooks, Discord, Lark/DingTalk custom bots, ntfy, Bark, n8n:

```yaml
- id: dsh-hooks
  name: dsh-hooks
  config:
    hooks:
      - on: 'turn/end'
        when: 'completed'
        run: 'node examples/notify-webhook.mjs --url https://hooks.slack.com/services/…'
      - on: 'tool/result'        # alert on tool failures
        run: 'node examples/notify-webhook.mjs --slack'
```

The URL may also live in the dsh process environment as `DSH_HOOKS_WEBHOOK_URL` (never in config files). `--slack` swaps the payload for a one-line `{ text }` summary; `--timeout <ms>` sets the fetch timeout (default 10000, one automatic retry on transport failure).

## Execution history

Every hook trigger is recorded into an in-memory ring buffer (default 500 entries) and best-effort appended to `~/.dsh/dsh-hooks/history.jsonl` (0600) — for future UIs and debugging. Records never contain secrets (env vars never enter records):

```yaml
- id: dsh-hooks
  name: dsh-hooks
  config:
    history:
      enabled: true        # optional: persist to disk (default true)
      max: 500             # optional: in-memory ring buffer size
      # path: '…'          # optional: custom JSONL path (default ~/.dsh/dsh-hooks/history.jsonl)
    hooks: […]
```

Each record: timestamp, kind (run/notify), event, command, session, outcome (spawned / exit-0 / exit-nonzero / timeout / sent / send-failed, …), exit code, duration, stderr tail. Disk failures are swallowed silently — history never blocks a hook.

## dry-run: verify config

Simulate an event to see which hooks would fire and why the others are filtered:

```sh
dsh-hooks dry-run turn/end --reason completed --profile web
# ✅ [1] [turn/end when=completed] run: node notify-feishu.mjs
# ⏭ [2] [turn/end when=error] run: … —— when 不匹配（期望 error，实际 completed）
# ⏭ [3] [tool/call] run: … —— 事件不匹配（tool/call ≠ turn/end）
# 共 1 个 hook 会触发。加 --execute 实际执行（真实副作用！）

dsh-hooks dry-run tool/call --tool ssh_exec --execute   # end-to-end: actually run the matching hooks
```

`dry-run` reads the profile's `cordis.patch.yml` (the `id: dsh-hooks` block) and validates the config (bad regexes fail here).

## Web profile HTTP routes

In the web profile (when the shared webServer service exists) dsh-hooks registers loopback-only `/dsh-hooks/*` routes — CLI/headless environments never see them:

| Route | Method | Purpose |
| --- | --- | --- |
| `/dsh-hooks/status` | GET | plugin version, hook count, history count |
| `/dsh-hooks/history?n=50` | GET | the latest N execution records (JSON envelope) |
| `/dsh-hooks/test` | POST | simulate an event: `{"event":"tool/call","tool":"ssh_exec","execute":false}` returns a per-hook match report; `execute: true` actually runs the matching hooks |

Security matches dsh-aionui-panel: loopback-only, POSTs require `application/json` (blocks cross-site form CSRF). The web profile also gets a systemPrompt section announcing the plugin to agents.

## Feishu notification example

The fastest path is the one-shot setup CLI — it creates the Feishu app for you via a QR-code scan and writes all hook config:

```sh
dsh-hooks feishu-setup                 # default profile: web
dsh-hooks feishu-setup --profile work  # another profile
dsh-hooks feishu-test                  # send a test card with the stored credentials
```

`feishu-setup` prints a QR code (and opens it in your browser), waits for you to scan it with Feishu, then creates an app named 「DSH 通知机器人」 with message-send permission and writes:

| File | Purpose |
| --- | --- |
| `~/.dsh/dsh-hooks/feishu-config.json` | app id/secret + your open_id as the notification target (0600, never committed); `result_max_chars` sets the card content truncation (default 300) |
| `~/.dsh/dsh-hooks/notify-feishu.mjs` | stable copy of the notify script the hooks reference |
| `~/.dsh/profiles/<profile>/cordis.patch.yml` | dsh-hooks block: `turn/end` (completed/error/aborted) + `approval/asked` + `agent/error` card hooks |

Restart `dsh web` afterwards — you will get cards when turns finish, approvals are asked, or the agent errors.

![Feishu card example](assets/screenshot-1.jpg)

### Manual configuration

Prefer wiring it by hand? See [`examples/notify-feishu.mjs`](examples/notify-feishu.mjs) — a zero-dependency script that posts turn-completion / approval notices through the Feishu **app API** (works without a group custom bot). Configure it like:

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

with `DSH_HOOKS_FEISHU_APP_ID` / `DSH_HOOKS_FEISHU_APP_SECRET` / `DSH_HOOKS_FEISHU_TO` in the process environment (never in config files).

## Security

Hooks execute arbitrary commands with the dsh process privileges. Only configure commands you trust. Secrets belong in environment variables or the dsh credential store — never in `cordis.patch.yml`.

## Design

Follows the dsh plugin conventions: `dsh.bundle.patch` mounts the plugin row, the plugin listens to the durable `session/event` firehose plus agent lifecycle events, and emissions are irreversible side effects that compensate rather than block (failures warn, never retry).

## Development

```sh
pnpm install
pnpm run check     # typecheck + test + build
```

Releasing and CI operations (Trusted Publishing, security scanning, gotchas): see [docs/RELEASING.md](docs/RELEASING.md).

## License

MIT
