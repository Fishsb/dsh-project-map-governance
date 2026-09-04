# 模块 · engine

> 一级模块：目录。职责/影响需人工/agent 补充。

- **路径**：`engine`
- **类型**：目录
- **职责**：规则引擎（Node 标准库，零依赖）——scripts/ 命令（init/sync/check/status/reconcile/adr/devref）+ lib-parse/lib-links 公共层 + mcp-server；SKILL.md 引擎文档；test/smoke.mjs 回归
- **负责**：PM 工程
- **改动影响**：所有被治理项目的 check/sync/init 行为；hook/CLI/DSH 插件/MCP 四方契约；改动须跑 engine/test/smoke.mjs 回归（用例数以运行输出为准，计数声明已去数字化）+ 同步部署副本

## 相关模块
<!-- 跨模块影响面：改本模块必须同步检查的模块。方向：本模块影响它 / 本模块依赖它 / 双向。由 sync --links 给候选，人工确认后填。 -->
- `src/` — 双向：src 把引擎命令注册为 DSH 工具（依赖引擎 CLI/--json 契约）；引擎改动可能改变 src 注册工具的行为
- `scripts/` — 弱关联：引擎独立于仓库构建脚本 scripts/build.sh（各自 scripts/ 目录同名但无代码依赖）；引擎测试在 engine/test 内自洽

> 文件级细节见 ../tree/engine.md。
