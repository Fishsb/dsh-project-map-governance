# Changelog

所有重要变更将记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本化遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **版本说明**：本仓库是 DSH 插件契约与打包；治理**引擎**（`scripts/*.mjs`）随 skill 目录独立维护，其历史演进见引擎 `SKILL.md`（v1 → v2 信息类分层 → v2.2 语义闭环 → v3 规则引擎）。插件版本号仅表示本仓库的发布节奏。

## [Unreleased]

### Added

- 架构决策记录 ADR-0001：薄契约层架构（插件仓库只含工具注册，引擎随 skill 目录独立演进）。
- docs/map 语义回填：root/src.md、root/scripts.md 的 职责/负责/改动影响/相关模块；index.md 一句话摘要与引擎位置声明；AGENTS.md/CLAUDE.md 一句话描述。

### Changed

- 版本标注统一 v3：AGENTS.md、CLAUDE.md、pre-commit hook（原为 v2 生成文案）。
- README/README.en：工具名更正为实际注册名 `_dsh_external_project_map_governance_*`；引擎位置声明改为「skill 目录独立维护，非本仓库 scripts/」；MCP 示例路径更正。
- governance.json：`rules.changelog` 由 `error` 改为 `off`——仓库尚无 git tag 基线，error 门禁实际永不触发（无 tag 时 check 跳过），改 off 使声明与行为一致（发布打 tag 后可再开启）。

### Fixed

- docs/map/decisions/ADR-0001.md 状态行生成缺陷（`acceptedproposed` 拼接）已修正为规范枚举。

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
