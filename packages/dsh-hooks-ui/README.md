# @PeterBon/dsh-hooks-ui

[dsh-hooks](../README.md) 的 Web GUI 面板插件（双面插件）：侧边栏「Hooks」入口 + 抽屉仪表板，消费核心插件的 `/dsh-hooks/*` 路由。

## 能力

- **执行历史时间线**：最近 50 条 hook 触发（时间 / 事件 / 命令 / 结果 / stderr 尾部），5 秒自动刷新
- **状态徽章**：插件版本、hook 数、历史条数
- **手动测试**：选择事件（14 类）+ reason/tool，模拟查看逐 hook 匹配报告，或真实触发

## 安装

```sh
dsh plugin --profile web add @PeterBon/dsh-hooks-ui
```

依赖 dsh-hooks 核心插件（本仓库根包）。重启 `dsh web` 后侧边栏出现「Hooks」入口。

## 开发

```sh
pnpm install
pnpm --filter @PeterBon/dsh-hooks-ui run check   # typecheck + test + build
```

构建产物 `lib/` 提交到仓库（git 安装不构建）。侧边栏入口用 DOM 注入 + MutationObserver 自愈（dsh-task-board 同款模式）；面板失败只打日志，绝不让 web shell 崩溃。
