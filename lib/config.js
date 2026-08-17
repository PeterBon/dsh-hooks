import Schema from '@deepseek-ai/schemastery';
/** Hookable event kinds. v1 is emit-only: no waterfall/interception events. */
export const HOOK_EVENTS = [
    'turn/start',
    'turn/end',
    'step/end',
    'tool/call',
    'tool/result',
    'user/message',
    'approval/asked',
    'session/title',
    'session/created',
    'session/disposed',
    'agent/created',
    'agent/disposed',
    'agent/error',
    'agent/status',
];
/** `turn/end` reason kinds (from @deepseek-ai/dsh-session TurnEndReasonMap). */
export const TURN_END_REASONS = [
    'completed',
    'error',
    'aborted',
    'blocked',
    'max-tokens',
    'interrupted',
];
// Explicit structural annotation: the inferred Schema type names the
// cosmokit transitive dependency, which is not portable across pnpm
// installations. Annotating with the schemastery callable shape keeps the
// declaration self-contained.
export const Config = Schema.object({
    hooks: Schema.array(Schema.object({
        on: Schema.union([...HOOK_EVENTS]).description('触发事件：turn/start | turn/end | step/end | tool/call | tool/result | user/message | approval/asked | session/title | session/created | session/disposed | agent/created | agent/disposed | agent/error | agent/status'),
        when: Schema.union([...TURN_END_REASONS]).description('可选过滤：对 turn/end 匹配结束原因（completed/error/aborted/blocked/max-tokens/interrupted）；其他事件忽略该字段'),
        match: Schema.dict(Schema.regExp()).description('可选通用过滤：字段 → 正则，全部匹配才触发。字段为上下文键（tool/sessionName/sessionId/error/source/cwd/content/reason/…），上下文中不存在的字段视为不匹配'),
        run: Schema.string().description('触发时通过系统 shell 执行的命令（与 notify 二选一）'),
        notify: Schema.union([
            Schema.object({
                channel: Schema.union(['webhook', 'desktop'])
                    .required()
                    .description('通知渠道：webhook 发 HTTP JSON；desktop 发系统桌面通知'),
                url: Schema.string().description('webhook 渠道的目标 URL（缺省时用环境变量 DSH_HOOKS_WEBHOOK_URL）'),
                slack: Schema.boolean().default(false).description('webhook 渠道：改为发送 Slack 风格 { text } 单行摘要'),
            }),
            Schema.const(null),
        ])
            .default(null)
            .description('内置通知（与 run 二选一）：配置驱动发送，无需外部脚本'),
        input: Schema.union(['env', 'stdin'])
            .default('env')
            .description('上下文传递方式：env 只传 DSH_HOOK_* 环境变量（默认）；stdin 额外把完整上下文 JSON 写入命令标准输入'),
        timeoutMs: Schema.number().default(10000).description('单次执行超时（毫秒）'),
        retries: Schema.natural().default(0).description('非零退出码的重试次数（默认 0 不重试；spawn 失败与超时不重试）'),
        retryDelayMs: Schema.natural().default(500).description('重试基础间隔（毫秒），每次翻倍'),
    }).description('一个事件 → 命令/通知的 hook 声明'))
        .default([])
        .description('事件触发时执行的外部命令列表；按声明顺序触发'),
}).description('dsh-hooks 配置：声明式生命周期 hooks');
