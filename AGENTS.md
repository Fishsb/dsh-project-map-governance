# AGENTS.md — dsh-project-map-governance-plugin 协同治理入口

> dsh-project-map-governance：DSH 原生项目治理工具包（项目地图 + 更新日志，规则引擎化 check）。单一仓库双目录：`src/` 插件契约层 + `engine/` 引擎源码（ADR-0002）。

## 开工前必读
- **项目地图** → `docs/map/index.md`（LLM 友好导航：先读摘要，再按指针下钻，禁止全项目扫描）
- **用户确定事实** → `docs/map/facts.md`（active 事实=已确认约束，禁止破坏）
- 更新日志 → `CHANGELOG.md` 的 [Unreleased]

## 规则
0. **用户事实铁律**：改代码前读 `docs/map/facts.md`；active 事实是用户已确认的约束——**禁止破坏**（含 F-002 不发布版本 / F-003 本地不保留 tag）。开发与事实冲突 → 停下升级用户决策（不自行绕过）；用户方向变动 → 同步评估受影响事实、询问用户后更新（active→superseded + 冲突处理记录）。
1. **改前影响分析**：先读目标模块 `docs/map/root/<模块>.md`，特别是「相关模块」节——跨模块关联（功能逻辑 ↔ 展示层等）是本项目漂移高发区。
2. **改后同步**：新增/删除/移动文件 → `node engine/scripts/sync.mjs .`（引擎在本仓 engine/）；用户可感知改动 → 写 CHANGELOG。
3. **提交前**：pre-commit 自动 `check` 地图；漂移会拦截 commit（提示先 sync）。
4. **决策与变更记录**：重大架构/技术决策 → 记 ADR（`node engine/scripts/adr.mjs . "<标题>"`）；用户可感知改动 → CHANGELOG.md [Unreleased]。

_初始化于 2026-09-02 — 由 project-map-governance/init.mjs v3 生成。引擎见本仓 engine/SKILL.md_
