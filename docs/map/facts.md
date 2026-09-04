# 用户确定事实（User-Confirmed Facts）

> 记录用户在本项目开发过程中拍板确定的事实。**active 事实 = 已确认的开发约束——禁止破坏**；
> 开发与事实冲突 → 停下升级用户决策；用户方向变动 → 同步评估受影响事实、询问用户后更新。
> 状态：`active` ｜ `superseded`；superseded 必须保留冲突处理记录（用户决策历史，勿删）。
> 每条带「约束范围」（反引号路径/模块/关键词）供 check 检测变更是否触及。

## 事实

### [F-001] 引擎与插件契约单一仓库双目录（engine/ 子目录）
- 状态：active
- 确认日期：2026-09-02
- 约束范围：`src/`、`engine/`、`docs/map/decisions/`
- 事实：本仓库同时承载插件契约层（src/，注册 DSH 原生工具）与规则引擎（engine/，scripts/*.mjs 等）。架构决策见 ADR-0002（supersede ADR-0001 的"引擎独立于插件仓"）。引擎改动不得破坏插件契约的 6 工具注册与 `--json` 结构化返回契约。
- 冲突处理：

### [F-002] GitHub 不发布版本（无 tag / 无 release）
- 状态：active
- 确认日期：2026-09-02
- 约束范围：`README.md`、`README.en.md`、`CHANGELOG.md`、发布流程
- 事实：GitHub 仓库 `dsh-project-map-governance` 不创建 tag、不发布 release（版本发布需用户明确指示）。main 分支历史即版本保护。涉及发布/打 tag/release 的改动须先询问用户。
- 冲突处理：

### [F-003] 本地也不保留 tag
- 状态：active
- 确认日期：2026-09-02
- 约束范围：git 操作约定、`CHANGELOG.md`
- 事实：本地 git 同样不保留 tag（含版本备份 tag）——用户明确"本地也不需要"。防止改动丢失依赖 main 分支提交历史，不用 tag 标记。
- 冲突处理：

### [F-004] 治理插件自身自治理（self-hosting），引擎改动必须回归
- 状态：active
- 确认日期：2026-09-02
- 约束范围：`engine/test/`、`engine/scripts/`
- 事实：本插件用自己的治理引擎治理自身（AGENTS/docs/map/pre-commit）。引擎任何行为改动必须通过 `engine/test/smoke.mjs` 回归（用例数以运行输出为准，计数声明已去数字化）并同步 skill 运行副本（`C:\Users\lk\.dsh\skills\project-map-governance`）后方可提交。
- 冲突处理：

### [F-005] 治理文档导航概况 = 高密度描述（非记忆极简标签）
- 状态：active
- 确认日期：2026-09-02
- 约束范围：`engine/SKILL.md`、`docs/map/index.md`
- 事实：index.md 导航概况用 ≤40 字高密度描述（含模块职责要点与关键实体），让模型见导航即形成模块理解——区别于记忆插件的 ≤30 字极简路由标签（治理文档导航即信息，漏要点 = 治理漂移风险）。
- 冲突处理：
