# 模块 · tsconfig.json

> 一级模块：配置文件。职责/影响需人工/agent 补充。

- **路径**：`tsconfig.json`
- **类型**：文件
- **职责**：TypeScript 编译配置（src → lib，供 tsc / build.sh 使用）
- **负责**：工具链
- **改动影响**：构建产物 lib/ 的输出结构/声明文件；typecheck 行为

## 相关模块
<!-- 跨模块影响面：改本模块必须同步检查的模块。方向：本模块影响它 / 本模块依赖它 / 双向。由 sync --links 给候选，人工确认后填。 -->
- `src/` — 本模块编译 src 源码
- `scripts/build.sh` — 本模块由 build.sh 以 `tsc -p tsconfig.json` 调用
- `package.json` — typecheck 脚本指向本配置

> 文件级细节见 ../tree/tsconfig_json.md。
