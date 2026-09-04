# 模块总览 · dsh-project-map-governance-plugin

> 模块级职责/影响面。**相关模块 = 跨模块影响面**：改一个模块前必须检查其相关模块。
> 本表由 sync 从 root/<模块>.md 自动汇总（【模块表】标记之间请勿手改）；候选可由 `sync --links` 探测。

<!-- MODULE_TABLE_BEGIN -->
| 模块 | 职责 | 相关模块 |
|---|---|---|
| `engine` | 规则引擎（Node 标准库，零依赖）——scripts/ 命令（init/sync/check/status/reconcile/adr/devref）+ lib-parse/lib-links 公共层 + mcp-server；SKILL.md 引擎文档；test/smoke.mjs 回归 | `src`、`scripts` |
| `scripts` | 仓库内构建与素材管理——build.sh（DSH checkout 探测 + vendor junction + tsc 编译 src→lib） | `src`、`engine` |
| `src` | 插件契约层——把引擎 6 命令（init/sync/check/adr/status/reconcile）注册为 DSH 原生工具，参数 schema + 结构化返回（check --json） | `engine`、`scripts` |
<!-- MODULE_TABLE_END -->
