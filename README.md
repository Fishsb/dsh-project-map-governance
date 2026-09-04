# dsh-project-map-governance

`@dsh-external/project-map-governance` —— 面向 DeepSeek Harness 的**项目地图 + 更新日志治理**工具包。

它为 vibe / AI coding 项目安装一套可持续、可缩放的治理层，并把治理命令以 **DSH 原生工具**的形式提供给 agent：

- **结构锚**：`AGENTS.md`(`CLAUDE.md`) + `docs/map/{index,root,tree,decisions}`，信息类主辅分离 + 渐进披露
- **语义闭环**：跨模块关联（出边+反向）、CHANGELOG、ADR、语义字段——全部可由 `off|warn|error` 规则门禁
- **防漂移**：pre-commit 自动 check；规模审查 + 文档卫生 reconcile
- **零依赖**：引擎仅用 Node 标准库；工具注册基于 Cordis / schemastery

> 设计与生态对照（渐进披露 / AGENTS.md 标准 / llms.txt / ADR / Changelog Enforcer / document-hygiene）见下方「背景」章节的链接。

## 工具（本插件注册到 Harness）

| 工具（DSH 注册名） | 作用 |
|---|---|
| `_dsh_external_project_map_governance_init` | 初始化治理：AGENTS/CLAUDE + docs/map + CHANGELOG + pre-commit |
| `_dsh_external_project_map_governance_sync` | 改动后同步：tree 按粒度刷新 + root.md 派生表 + index reconcile |
| `_dsh_external_project_map_governance_check` | 规则审查（结构化返回）：dead-links / relatedness / changelog / semantics / … |
| `_dsh_external_project_map_governance_adr` | 新建架构决策记录 ADR-NNNN.md |
| `_dsh_external_project_map_governance_status` | 治理状态快照（配置/粒度/模块/ADR/reconcile 天数） |
| `_dsh_external_project_map_governance_reconcile` | 文档卫生 reconcile 清单 |

## 引擎与形态

**引擎**（Node 标准库脚本，**零第三方依赖**，运行于 Harness 自带 Node 22+）**在本仓库 `engine/` 子目录**（ADR-0002）：

```
engine/
├── SKILL.md               引擎完整文档与迁移说明
├── governance.schema.json 治理配置 schema
├── scripts/
│   ├── lib-parse.mjs   统一解析层（文档格式 / 配置 schema 单一源）
│   ├── lib-links.mjs   跨模块引用扫描器（相对/绝对导入）
│   ├── init / sync / check / adr / status / reconcile / devref
│   └── mcp-server.mjs  MCP stdio 薄包装（供 Claude Code 等其他 agent）
└── test/smoke.mjs      引擎回归（用例数以运行输出为准）
```

本插件是**引擎的一层薄契约**：把同套脚本包装成 DSH 原生工具（`check` 走 `--json` 结构化返回）。因此：

- pre-commit hook、CLI、DSH 插件、MCP —— 四方共用同一引擎，行为一致
- `src/` 注册 6 个 DSH 工具（契约层）；`engine/scripts/*.mjs` 是引擎命令；`scripts/build.sh` 是仓库自身构建脚本（非引擎命令）
- 引擎自定位基于 `import.meta.url`（向上两级解析），本仓 `engine/` 下即插即用；也可部署到其他目录（如 skill 运行副本）
- 项目级产物（`docs/map/**`）是**项目内文档**，不入本仓库

> **引擎部署副本**：`C:\Users\lk\.dsh\skills\project-map-governance` 是引擎的运行副本（从本仓 `engine/` 同步，供本机 skill 体系加载）。

## 安装与注入

依赖：Node.js 22+（Harness 自带）、装有 dsh-super-injector 的 Harness 环境。

```powershell
git clone https://github.com/Fishsb/dsh-project-map-governance
cd dsh-project-map-governance

# 1) 构建（需要 DSH 源码 checkout，用于 tsc 与 vendor 依赖）：
$env:DSH_CHECKOUT = "C:\path\to\dsh\source"
bash scripts/build.sh

# 2) 注入（免重启，热加载）：
#    在 Harness 会话内调用 dev_inject_plugin <本目录>；
#    或标准安装：dsh plugin --profile web add <本目录>
```

> 无 DSH 源码 checkout 的环境下，可将预构建的 `lib/` 一并放入包内（默认被 `.gitignore` 忽略以保持仓库纯净）；`lib/index.js` 与本仓库 `src/index.ts` 一一对应。

> 本仓库 clone 后即本地开发/注入用；如已 clone 到别的目录名，注入/构建时以实际目录为准。

注入成功后，6 个治理工具出现在 Harness 工具表中（带参数 schema 与结构化返回），无需再走 bash。

## 配置

引擎配置位于项目内 `docs/map/governance.json`：

```jsonc
{
  "configVersion": 3,
  "level": "files",              // files|dirs|modules（按文件数自动降档）
  "roots": ["src"],              // 白名单模块（可选）
  "links": true,                 // 跨模块引用自扫描
  "rules": {                     // 规则表：off|warn|error（error=门禁）
    "dead-links": "error",
    "relatedness": "warn",
    "changelog": "off",
    "semantics": "warn",
    "doc-hygiene": "warn"
  }
}
```

v2 及更早的 legacy 字段（`strict`/`strictLinks`/`changelog`/`strictSemantics`）在首次运行时**自动迁移**到 `rules`（`configVersion: 3`），无需手工迁移。

## 为其他 agent 提供（MCP）

```bash
claude mcp add project-map-governance -- node <repo>/engine/scripts/mcp-server.mjs
```

`<repo>` 即本仓库克隆路径（引擎在 `engine/` 子目录）。以 MCP 工具形式向任意支持 MCP 的 agent 暴露同 6 个能力。

## 兼容性

- 目标：本地 Harness（DeepSeek Harness，含 dsh-super-injector）
- 插件自身：`@deepseek-ai/dsh-tools` / `cordis` / `schemastery`（`peerDependencies`，由注入器通过 junction 链接到宿主自带包）
- 引擎：Node 标准库，无第三方安装

## 背景与设计对照

- [A Complete Guide To AGENTS.md](https://www.aihero.dev/a-complete-guide-to-agents-md)（渐进披露）
- [llms.txt](https://llmstxt.org/)（LLM 导航文件）
- [ADRs](https://adr.github.io/)（架构决策记录）
- [Changelog Enforcer](https://dangoslen.me/blog/enforcing-a-changelog-with-github-actions/)
- [document-hygiene](https://github.com/muellah24/document-hygiene)

## 协议

[BSD-3-Clause](LICENSE)

English: [README.en.md](README.en.md)
