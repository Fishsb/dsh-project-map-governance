# Changelog — project-map-governance 引擎

引擎（`engine/scripts/*.mjs`）随 DSH 插件仓 `dsh-project-map-governance` 的 `engine/` 子目录维护与演进（ADR-0002，单一仓库双目录）。本文件按 Keep a Changelog 记录引擎的用户可感知变更；插件契约层变更见插件仓根 `CHANGELOG.md`。

> 引擎源码在本仓 `engine/`；部署运行副本 = 本机 skill 目录 `C:\Users\lk\.dsh\skills\project-map-governance`（改动引擎：改本仓 → 回归 `engine/test/smoke.mjs` → 同步 skill 副本）。历史上曾短暂采用独立引擎仓方案（见下方 [Unreleased] 标注），已废弃并并入本仓。

## [Unreleased]

### Added

- ~~**引擎源码仓 + 自治理（self-hosting）**~~（已废弃，见 ADR-0002）：曾将引擎纳入独立 git 仓 `D:\FF\dsh-project-map-governance-engine` 并自治理；该方案被 ADR-0002 取代（引擎并入插件仓 `engine/` 子目录），独立仓已删除。保留此条仅为记录历史。

### Fixed

- **维护成本降本（v3.3）**：规则注册单点化（RULE_DESC 描述单一源 + assertRuleRegistry 启动断言 + gen-schema-check.mjs 守护/--fix 重写 schema）；sync-copy.sh 一键同步 skill 副本；engine/README 收敛为入口指向 SKILL.md（消除重复维护面）。
- **user-facts 规则（v3.2）**：`docs/map/facts.md` 用户确定事实——init 生成模板 + AGENTS 规则 0 铁律；check 变更触及 active 事实「约束范围」→ error（git staged/工作区 diff 匹配路径/模块/关键词）；facts 文档完整性（状态/日期/约束范围/superseded 冲突记录）→ warn；11 规则注册（RULE_IDS/defaultRules/schema）。约束范围尾斜杠 bug 已修（`src/` 匹配 `src/b.js`）。
- **导航概况规范（v3.1）**：index.md 导航概况标准化——≤40 字高密度描述含职责要点（见导航即理解，区别于记忆极简路由）；semantics 报概况待填（warn 级不随 strictSemantics 升级）、index-format 报超长/失真（子串关联判定）。
- **root.md 派生表 3 列化**：去"负责"列（模块|职责|相关模块；运行时/维护信息分离，负责留 root/<模块>.md）；sync 汇总、check root-consistency、init 模板、smoke 同步。
- **治理逻辑完整性（规则引擎）**：
  - 边界常量单源化进 lib-parse（IGNORE_NAMES/ROOT_DOC/BINARY_EXT/isCfgFile/safeName/governedRootDocs），check/sync/init 统一 import。
  - semantics 守护根级配置文件模块 root 文档；待填判定兼容异常拼接。
  - dead-links 扩展扫 root/index/decisions 内部链接；修复 init 模板与 devref.mjs 的 `../` 少一层死链。
  - changelog 无 tag 基线时给 warn 提示（不再静默）。
- **init 死链根因**：文件类模块（package.json/tsconfig.json 等）不再生成 `> 文件级细节见 ../tree/<模块>.md` 尾行——此前 init 一出生就为配置文件模块写入指向不存在 tree 文件的死链（dead-links 只扫 tree/ 故静默）。
- **sync root/ 孤儿清理**：模块删除后 `root/*.md` 不再残留（原只清 tree/）；模块集合 = 目录模块 + 根级配置文件模块，配置文件 root 文档正确保留。
- **sync 空目录提前退出**：治理范围内无目录模块时不再 `process.exit(0)` 跳过清理——此前会遗留全部陈旧 tree/root 文档。

## [v3] - 2026-09-02

### Added

- **规则引擎化**：`docs/map/governance.json` 声明 `rules` 表（10 条规则：dead-links / untracked-strict / relatedness / changelog / semantics / size / root-consistency / index-consistency / index-format / doc-hygiene），severity `off|warn|error`，error 级 = pre-commit 门禁 exit1。
- **legacy 配置自动迁移**：v1/v2.x 字段（strict/strictLinks/changelog/strictSemantics）首跑自动迁移为 rules（configVersion 3），无需手改。
- **`lib-parse.mjs` 统一解析层**：文档格式与配置 schema 单一源（init/sync/check/adr/reconcile/插件/MCP 共用）。
- **`status.mjs`**：治理状态快照（配置/粒度/模块/关键文档存在性/ADR 数/reconcile 天数）。
- **`reconcile.mjs`**：文档卫生清单（git 改动/疤痕/超期），`--done` 落时间戳。
- **`check --json`** 结构化输出（DSH 插件 / MCP 消费）。
- **`autoLevel` 阈值可配**（governance.json.autoLevel）。
- **DSH 插件 6 原生工具 + MCP stdio 薄包装**（`mcp-server.mjs`）：三方（hook/CLI/插件）共享同一引擎。
- **引擎回归测试**：`test/smoke.mjs`（84 用例，覆盖三档粒度/迁移/门禁/ADR/卫生）。

### Changed

- 引擎内部命令入口统一 v3；`configVersion` 恒为 3。

## [v2.2] - 2026-08-xx

### Added

- `adr.mjs` 支持 `--status`，ADR 登记进 decisions/README.md 索引。

## [v2.1] - 2026-08-xx

### Added

- `lib-links.mjs` 公共跨模块扫描器（相对/绝对/点风格/`<>`/Python import），check `links:true` 时自扫描，出边+反向双向校验。
- link-triage 噪音豁免（`docs/map/memo/link-triage.md`）。

## [v2] - 2026-08-xx

### Added

- 信息类主辅分离：主文档按主题组织（摘要/模块地图/关键文件/约定/决策），渐进披露 L0/L1/L2。
- 模块关联层：root/<模块>.md「相关模块」节；粒度 files→dirs→modules 自动降档。
- AGENTS.md + CLAUDE.md 双写；index.md llms.txt 式；规模审查提示（200 行/15 模块/100 文件）。
- `devref.mjs`：官方开发参考文档部署（docs/devref/ 本地化，gitignore 排除）。

## [v1] - 2026-07-xx

### Added

- 初版：AGENTS.md + docs/map（root/tree）+ CHANGELOG + pre-commit；tree 全量文件登记。
