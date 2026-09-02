# 模块 · package.json

> 一级模块：配置文件。职责/影响需人工/agent 补充。

- **路径**：`package.json`
- **类型**：文件
- **职责**：插件清单（@dsh-external/project-map-governance v0.1.0）——名称/peerDependencies（dsh-tools/cordis/schemastery）/构建与类型检查脚本/发布元数据
- **负责**：PM 工程
- **改动影响**：插件安装契约（peerDeps 需宿主 junction 提供）；build/typecheck 脚本入口；npm pack 产物范围（files: lib）

## 相关模块
<!-- 跨模块影响面：改本模块必须同步检查的模块。方向：本模块影响它 / 本模块依赖它 / 双向。由 sync --links 给候选，人工确认后填。 -->
- `src/` — 双向：package.json 声明的依赖与 src 的 import 契约同构
- `scripts/build.sh` — 本模块 build 脚本指向 scripts/build.sh
- `tsconfig.json` — 本模块 typecheck 脚本依赖 tsconfig 编译配置
