# Changelog

所有重要变更将记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本化遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **版本说明**：本仓库 = 插件契约层 + 引擎（单一仓库双目录，ADR-0002）。插件契约在 `src/`（DSH 工具注册与打包）；治理**引擎**（`engine/scripts/*.mjs`）随本仓维护，历史演进见 `engine/CHANGELOG.md`（v1 → v2 → v3 规则引擎）。插件版本号表示本仓库发布节奏。

## [Unreleased]

### Added

- **导航深度门禁（nav-depth 规则，引擎 v3.5）**：改动一个功能需在 3 次主动检索内触达所有受影响同步文档——check 从治理入口 BFS 文档指针图，孤儿文档（无入链）与超 `hints.navMaxDepth`（缺省 3）跳数的文档即违规；本仓自治理 nav-depth=error，并修复 3 处实际断链（root-files/tsconfig_json 入链、link-triage 经 root/scripts.md 回填指针）。
- **ADR 状态一致性门禁（adr-status-consistency 规则，引擎 v3.4）**：`decisions/README.md` 状态列 ↔ `ADR-NNNN.md`「> 状态：」行强制一致 + 状态行选项菜单残留拦截（默认 error=漂移拦截 commit）——把 dsh-managing-memory 治理漂移事故（ADR 拍板后文件/索引状态失真，靠 reconcile 人读兜底）升级为 check 机检；`adr.mjs` 生成改为单一状态词从源头根治模板疤痕。
- **计数声明去数字化（治理纪律）**：现状类文档（README/CONTRIBUTING/root*.md/facts）不再写用例数等易漂移数字（改「以运行输出为准」），历史快照保留原数字——杜绝 v3.1→v3.3 期间 8 处「84 用例」陈旧计数式的漂移。

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
- **硬编码清理**：engine/test/smoke.mjs 的引擎路径由「C:\Users\lk\.dsh\skills\... 绝对路径」改为 import.meta.url 自定位本仓 engine/scripts（可移植）；engine/scripts/init.mjs 删除 hermes 机器特定 node 探测候选（保留 execPath/DSH_NODE/Program Files/which 通用探测）。
- **废弃引用清理**：engine/SKILL.md 删除指向已删独立引擎仓的引用、`<skill-dir>` 通用化为「引擎部署位置（本仓 engine/ 或副本）」；engine/CHANGELOG.md 头部改为「随插件仓 engine/ 维护」，独立仓方案条目标注已废弃（历史记录）。
- **治理逻辑完整性修复（规则引擎）**：
  - 边界常量单源化：IGNORE_NAMES/ROOT_DOC/BINARY_EXT/isCfgFile/safeName 收进 lib-parse，check/sync/init 统一 import（消除三处漂移，取并集含 .DS_Store/.map/.lock）。
  - semantics 扩展守护根级配置文件模块（package_json/tsconfig_json root 文档），不再"三无孤儿"；待填判定兼容异常拼接。
  - dead-links 扩展扫描 root/index/decisions 内链接（此前 root 内部死链盲区）；修复 index.md 与 init 模板「更新日志」链接少一层 `../` 的死链；修复 devref.mjs 登记 index 链接 `../` → `../../`。
  - changelog 无 git tag 基线时给 warn 提示（此前 error 静默失效）。
  - governance.schema.json 补 untracked-strict 粒度降级语义说明。
- **导航概况规范（v3.1，吸收 managing-memory 概况思想但适配治理场景）**：index.md 导航概况 = ≤40 字高密度描述（含模块职责要点/关键实体，让模型见导航即理解；区别于记忆插件的 ≤30 字极简路由标签——治理文档导航即信息，漏要点=漂移风险）；check semantics 报概况待填（始终 warn 不随 strictSemantics 升级）、index-format 报超长/与 root 职责失真（子串关联判定）。
- **root.md 派生表去"负责"列**（v11 运行时/维护信息分离）：表 = 模块|职责|相关模块 三要素；"负责"为维护信息留在 root/<模块>.md 不进派生表（sync 汇总/check 一致性同步改）。
- **用户确定事实机制（user-facts，v3.2）**：新增 `docs/map/facts.md` 记录用户拍板事实（active=已确认约束禁破坏）；AGENTS 规则 0「用户事实铁律」（禁破坏/冲突升级/方向变动同步评估）；check 新增 user-facts 规则（变更触及 active 事实约束范围→error 门禁；文档完整性缺失→warn）；本仓登记 F-001~F-005 真实用户事实；init 模板/索引/引擎 11 规则注册同步。
- **维护成本降本（v3.3）**：规则注册单点化——lib-parse 新增 `RULE_DESC`（规则描述单一源）+ `assertRuleRegistry`（check 启动断言实际执行规则 = RULE_IDS，防漏注册静默失效）；新增 `engine/scripts/gen-schema-check.mjs`（schema rules 段与 RULE_IDS 一致性守护，`--fix` 从 RULE_DESC 重写）；新增 `engine/scripts/sync-copy.sh`（一键同步引擎 → skill 副本 + 一致性验证）；engine/README.md 收敛为入口文档（权威指向 SKILL.md，消除双文档重复维护）。

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
