# 模块 · src

> 一级模块：Harness 插件入口与派生工具链。对外出口：SDK 原生 schema 校验 + Codis 上下文，派生工具链与 SDK 形态同构；只读，不自写。

- **路径**：`src`
- **类型**：目录
- **职责**：Harness 插件入口与派生工具链（SDK 原生 schema 校验 + Codis 上下文；派生工具链：governance-sdk / Codis 注入 / hybrid 形态同构 SDK 上下文）
- **负责**：PM 工程
- **改动影响**：SDK 原生 schema 校验 / Codis 上下文 / 派生工具链形态同构链路；任一变更须关联 `docs/map/tree/src.md`（文件级）与 `docs/map/governance.json`（治理配置）校验

## 相关模块
<!-- 跨模块影响面：改本模块必须同步检查的模块。方向：本模块影响它 / 本模块依赖它 / 双向。由 sync --links 给候选，人工确认后填。 -->
- （待填）：`package.json` — 与 Harness 插件契约同构
- （待填）：`scripts/` — 与构建与素材管理关联

> 文件级细节见 ../tree/src.md。
