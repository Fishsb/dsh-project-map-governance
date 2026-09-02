# Changelog

所有重要变更将记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本化遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **版本说明**：本仓库 = 插件契约层 + 引擎（单一仓库双目录，ADR-0002）。插件契约在 `src/`（DSH 工具注册与打包）；治理**引擎**（`engine/scripts/*.mjs`）随本仓维护，历史演进见 `engine/CHANGELOG.md`（v1 → v2 → v3 规则引擎）。插件版本号表示本仓库发布节奏。

## [Unreleased]

### Added

- **引擎并入本仓库（ADR-0002，supersede ADR-0001）**：`engine/` 子目录承载引擎源码（SKILL.md + scripts/*.mjs + governance.schema.json + test/smoke.mjs）；引擎自定位基于 import.meta.url 故 engine/ 下即插即用；skill 目录降级为运行部署副本。
- 架构决策记录 ADR-0001：薄契约层架构（插件仓库只含工具注册，引擎随 skill 目录独立演进）。
- docs/map 语义回填：root/src.md、root/scripts.md 的 职责/负责/改动影响/相关模块；index.md 一句话摘要与引擎位置声明；AGENTS.md/CLAUDE.md 一句话描述。
- 引擎回归纳入本仓：`engine/test/smoke.mjs`（84 用例）。

### Changed

- 版本标注统一 v3：AGENTS.md、CLAUDE.md、pre-commit hook（原为 v2 生成文案）。
- README/README.en：工具名更正为实际注册名 `_dsh_external_project_map_governance_*`；引擎位置声明改为「本仓 engine/ 子目录（ADR-0002），skill 目录为部署副本」；MCP 示例路径更正为 `<repo>/engine/scripts/`。
- **插件默认引擎路径**：`src/index.ts` 的 scriptsDir 默认值由「skill 目录绝对路径」改为「动态定位本仓 engine/scripts」（import.meta.url，clone 即用可移植；可用 Config.scriptsDir 覆写）。
- governance.json：`rules.changelog` 由 `error` 改为 `off`——仓库尚无 git tag 基线，error 门禁实际永不触发（无 tag 时 check 跳过），改 off 使声明与行为一致（发布打 tag 后可再开启）。
- 治理范围新增 `engine` 模块；link-triage 登记 engine→src/scripts 噪音边（lib-links 注释示例 + smoke 测试夹具误判）。

### Fixed

- docs/map/decisions/ADR-0001.md 状态行生成缺陷（`acceptedproposed` 拼接）已修正为规范枚举；**引擎 adr.mjs 状态行拼接 bug 根因修复**（`> 状态：.*` 整行替换）。
- 引擎缺陷（随本仓 engine/）：init 不再为配置文件模块生成 `../tree/<模块>.md` 死链尾行；sync 增补 root/ 孤儿文档清理、模块清空时不再提前退出（此前 tree/root 陈旧文档残留）。本仓库 root/package_json.md、root/tsconfig_json.md 对应死链尾行已清除。

## [0.1.0] - 2026-09-02

### Added

- **DSH 原生工具集（6 个）**：`project_map_governance_init` / `_sync` / `_check` / `_adr` / `_status` / `_reconcile`，带参数 schema 与结构化返回（`check` 走 `--json`）。
- **规则引擎**：10 条规则（dead-links / untracked-strict / relatedness / changelog / semantics / size / root-consistency / index-consistency / index-format / doc-hygiene），severity `off|warn|error`，error 级=pre-commit 门禁。
- **配置 v3**：`governance.schema.json` 声明式规格；legacy 字段（strict/strictLinks/changelog/strictSemantics）首次运行自动迁移。
- **跨模块关联闭环**：模块级 import 扫描（相对/绝对/点风格/`<>`/Python），出边+反向双向校验，`link-triage.md` 噪音豁免，`strictLinks` 门禁。
- **开发过程闭环**：CHANGELOG 门禁、ADR 捕获（`adr`）、root.md 派生表、index reconcile、文档卫生 `reconcile`。
- **MCP 服务**：`scripts/mcp-server.mjs` stdio 薄包装，供其他 MCP agent（如 Claude Code）使用。
- **回归测试**：引擎 84 用例冒烟（`test/smoke.mjs`，覆盖三档粒度/迁移/门禁/ADR/卫生）。

### Notes

- 首个公开发布；引擎与插件版本解耦（引擎演进见其 `SKILL.md`）。
- 构建需要 DSH 源码 checkout（`DSH_CHECKOUT`）；无 checkout 时可直接用 `src/index.ts` 对应的预构建 `lib/`。
