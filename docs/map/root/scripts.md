# 模块 · scripts

> 一级模块：构建与素材管理。对外出口：build.sh 等构建与素材管理入口；只读，不自写。

- **路径**：`scripts`
- **类型**：目录
- **职责**：仓库内构建与素材管理——build.sh（DSH checkout 探测 + vendor junction + tsc 编译 src→lib）
- **负责**：工具链
- **改动影响**：构建与素材管理链路；与 Harness 插件入口与派生工具链同构 SDK 上下文链路联动

## 相关模块
<!-- 跨模块影响面：改本模块必须同步检查的模块。方向：本模块影响它 / 本模块依赖它 / 双向。由 sync --links 给候选，人工确认后填。 -->
- `src/` — 单向：build.sh 编译 src→lib，二者构建契约同构（改 src 需同步构建脚本）
- `engine/` — 无代码依赖：各自 scripts/ 子目录同名，但仓库 scripts/（build.sh）与 engine/scripts/（引擎命令）相互独立（link-triage 已豁免误判）
- `package.json` — 本模块文件：build 脚本入口与 scripts/build.sh 绑定

> 文件级细节见 ../tree/scripts.md。
