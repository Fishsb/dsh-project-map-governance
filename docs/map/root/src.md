# 模块 · src

> 一级模块：Harness 插件入口与派生工具链。对外出口：SDK 原生 schema 校验 + Codis 上下文，派生工具链与 SDK 形态同构；只读，不自写。

- **路径**：`src`
- **类型**：目录
- **职责**：插件契约层——把引擎 6 命令（init/sync/check/adr/status/reconcile）注册为 DSH 原生工具，参数 schema + 结构化返回（check --json）
- **负责**：PM 工程
- **改动影响**：SDK 原生 schema 校验 / Codis 上下文 / 派生工具链形态同构链路；任一变更须关联 `docs/map/tree/src.md`（文件级）与 `docs/map/governance.json`（治理配置）校验

## 相关模块
<!-- 跨模块影响面：改本模块必须同步检查的模块。方向：本模块影响它 / 本模块依赖它 / 双向。由 sync --links 给候选，人工确认后填。 -->
- `scripts/` — 双向：src 以引擎脚本为执行后端（依赖）；src 工具注册改动会改变 scripts 各命令的调用契约
- `package.json` — 本模块文件：插件清单/依赖/构建脚本与 src 契约同构

> 文件级细节见 ../tree/src.md。
