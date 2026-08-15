# dsh-hooks

Config-driven lifecycle hooks plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).

Declare `event -> command` hooks directly in your profile's `cordis.patch.yml` — like Codex CLI / OpenCode hooks, but for dsh. No plugin code required.

[中文文档](README.zh.md) | [Design](#design) | [Feishu example](examples/notify-feishu.mjs)

## Install

```sh
dsh plugin --profile web add github:PeterBon/dsh-hooks
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
```

## Events (v1)

| Event | When it fires | Useful context |
| --- | --- | --- |
| `turn/start` | A turn begins | session id, turn |
| `turn/end` | A turn ends (`completed` / `error` / `aborted` / `blocked` / `max-tokens` / `interrupted`) | reason, turn, duration |
| `approval/asked` | A tool call requests user approval | tool name, call id, reason |
| `agent/created` | An agent is published | session id |
| `agent/disposed` | An agent leaves the registry | session id |
| `agent/error` | The agent loop reports an error | error text |
| `agent/status` | Agent status transition | status |

The `when` filter for `turn/end` matches the `reason.kind` value (`completed`, `error`, …). Hooks for other events run unconditionally.

## Command execution

- Each matching hook spawns `run` through the platform shell, **fire-and-forget**: failures only `console.warn`, never retried, never block the agent loop.
- Context is passed via **environment variables** (no shell injection through data):

| Variable | Meaning |
| --- | --- |
| `DSH_HOOK_EVENT` | event type, e.g. `turn/end` |
| `DSH_HOOK_SESSION_ID` | session id |
| `DSH_HOOK_SESSION_NAME` | readable session title (latest `session/title` log event, or first human prompt) |
| `DSH_HOOK_TURN` | turn number (turn events) |
| `DSH_HOOK_REASON` | turn end reason kind |
| `DSH_HOOK_TOOL` | tool name (approval events) |
| `DSH_HOOK_CALL_ID` | tool call id (approval events) |
| `DSH_HOOK_DURATION_MS` | turn duration ms (turn/end) |
| `DSH_HOOK_STATUS` | agent status (`agent/status`) |
| `DSH_HOOK_ERROR` | error text (`agent/error`, and the failure message on `turn/end` error) |
| `DSH_HOOK_CONTENT` | the turn's final assistant text (turn events) |
| `DSH_HOOK_TIMESTAMP` | ISO timestamp |

- `{{var}}` placeholders inside `run` are substituted from the same context, e.g. `run: 'echo {{DSH_HOOK_SESSION_ID}} >> log.txt'`.

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
| `~/.dsh/dsh-hooks/feishu-config.json` | app id/secret + your open_id as the notification target (0600, never committed) |
| `~/.dsh/dsh-hooks/notify-feishu.mjs` | stable copy of the notify script the hooks reference |
| `~/.dsh/profiles/<profile>/cordis.patch.yml` | dsh-hooks block: `turn/end` (completed/error/aborted) + `approval/asked` + `agent/error` card hooks |

Restart `dsh web` afterwards — you will get cards when turns finish, approvals are asked, or the agent errors.

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

## License

MIT
