# AGENTS.md — dsh-project-map-governance-plugin 协同治理入口

> dsh-project-map-governance-plugin：<一句话项目描述，待填>

## 开工前必读
- **项目地图** → `docs/map/index.md`（LLM 友好导航：先读摘要，再按指针下钻，禁止全项目扫描）
- 更新日志 → `CHANGELOG.md` 的 [Unreleased]

## 规则
1. **改前影响分析**：先读目标模块 `docs/map/root/<模块>.md`，特别是「相关模块」节——跨模块关联（功能逻辑 ↔ 展示层等）是本项目漂移高发区。
2. **改后同步**：新增/删除/移动文件 → `node "C:/Users/lk/.dsh/skills/project-map-governance/scripts/sync.mjs" .`；用户可感知改动 → 写 CHANGELOG。
3. **提交前**：pre-commit 自动 `check` 地图；漂移会拦截 commit（提示先 sync）。
4. **决策与变更记录**：重大架构/技术决策 → 记 ADR（`node <skill>/scripts/adr.mjs . "<标题>"`）；用户可感知改动 → CHANGELOG.md [Unreleased]。

_初始化于 2026-09-02 — 由 project-map-governance/init.mjs v2 生成。skill 见 C:/Users/lk/.dsh/skills/project-map-governance/SKILL.md_
