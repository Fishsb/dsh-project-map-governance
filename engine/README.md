# project-map-governance — 项目地图 + 更新日志治理 skill（v3，规则引擎）

一套给 vibe/AI coding 项目的「项目地图 + 更新日志」双文档治理，让它**可持续、可复用、可缩放**。
关键：skill 生成的不是静态文档，而是**能自检的机制**（扫描→生成 → 改动后同步 → commit 前强制防漂移 → 规则引擎审查提示）。

## v3 设计要点（演进自 v2）

- **规则引擎化（v3）**：`docs/map/governance.json` 声明 `rules` 表（10 条规则 × `off|warn|error`），error 级 = pre-commit 门禁；legacy 字段（strict/strictLinks/changelog/strictSemantics）首跑自动迁移；`check --json` 结构化返回（DSH 插件 / MCP 用）。
- **信息类主辅分离**：主文档按主题组织（摘要/模块/关键文件/约定/决策），同 managing-memory 的分类法；模块是模块地图内的二级分组。
- **渐进披露**：L0 常读（AGENTS.md + index.md）→ L1 按任务（root/tree）→ L2 按需（memo/）；细节按链接取。
- **模块关联层**：root/<模块>.md「相关模块」节；`links:true` 时 check 自扫描（含相对导入解析）+ 出边/反向双向校验 + strictLinks 门禁 + link-triage 噪音豁免，防跨模块开发漂移。
- **规模自适应**：粒度 files→dirs→modules 自动降档；check 给拆分提示（主文档 >200 行 / 模块 >15 / 关键文件 >100）。
- **生态兼容**：AGENTS.md + CLAUDE.md 双写；index.md 采用 llms.txt 式分区（机器可解析）；MCP stdio 薄包装（`scripts/mcp-server.mjs`）。
- **性能**：15k 文件项目 check ~0.15s、sync ~0.3s；地图体积不再随文件数膨胀。
- **文档卫生 reconcile**：`reconcile` 列出需重读的治理文档（疤痕/改动/超期），`--done` 落时间戳。

## 命令（核心）

| 命令 | 作用 | 触发 |
|---|---|---|
| `init <项目>` | 扫描真实目录 → AGENTS.md+CLAUDE.md + docs/map（index/root/tree/decisions）+ governance.json + CHANGELOG + pre-commit | 新项目接入 |
| `sync <项目> [--links] [--list <模块>] [--reindex]` | 重扫 → 按粒度刷新 tree + root.md 派生表 + root/ 孤儿清理；`--links` 探测跨模块候选；`--list` 不落盘全量清单；`--reindex` 对齐 index | 每次改完代码 |
| `check <项目> [--strict] [--json]` | 规则引擎审查（10 规则 × severity）+ 审查提示；`--json` 结构化（插件/MCP） | commit 前（自动） |
| `status <项目> [--json]` | 治理状态快照（配置/粒度/模块/ADR/reconcile 天数） | 随时 |
| `reconcile <项目> [--days] [--done] [--json]` | 文档卫生清单 + 记录 reconcile 时间戳 | 文档体检 |
| `adr <项目> "<标题>" [--status]` | 新建 ADR-NNNN.md 并登记索引（重大决策落盘） | 重大架构/技术决策 |
| `devref <项目> <manifest>` | 官方开发参考 → docs/devref/ → 登记地图 + gitignore + check | init 之后推荐 |

退出码：`0` 成功/一致（可带提示），`1` 失败/漂移，`2` 参数错误。

## 使用

```powershell
node "C:\Users\lk\.dsh\skills\project-map-governance\scripts\init.mjs"  "D:\path\to\project"
node "C:\Users\lk\.dsh\skills\project-map-governance\scripts\sync.mjs"  "D:\path\to\project" --links
node "C:\Users\lk\.dsh\skills\project-map-governance\scripts\check.mjs" "D:\path\to\project" --json
node "C:\Users\lk\.dsh\skills\project-map-governance\scripts\reconcile.mjs" "D:\path\to\project" --done
node "C:\Users\lk\.dsh\skills\project-map-governance\scripts\devref.mjs" "D:\path\to\project" "manifest.json"
```

## init 产出（v3）

```
<项目>/
├── AGENTS.md                治理入口（收缩版：一句话 + 指针 + 规则）
├── CLAUDE.md                同 AGENTS.md（Claude Code 自动读）
├── CHANGELOG.md             更新日志（Keep a Changelog，已有则保留）
└── docs/map/
    ├── index.md             llms.txt 式总导航（H1+摘要+导航/治理+Optional）
    ├── governance.json      治理配置（level/roots/ignore/rules 表/links/...）
    ├── root.md              模块总览（模块表由 sync 从 root/* 派生）
    ├── root/                模块详情（职责 +「相关模块」关联层，单一事实源）
    ├── decisions/           ADR 架构决策记录（adr.mjs 新建）
    └── tree/                文件索引（files 全量 / dirs 骨架+关键文件 / modules 仅统计）
```

## 粒度与规模（自动 / --level 显式）

| 项目文件数 | 默认粒度 | tree 内容 |
|---|---|---|
| < 500 | files | 全量文件登记（v1 行为） |
| 500 ~ 2000 | dirs | 目录骨架 + 关键文件（有职责注记的）；全量 `sync --list` |
| > 2000 | modules | 仅模块统计；全量 `sync --list` |

## 配置 `docs/map/governance.json`

`configVersion`（当前 3）/ `level`（粒度）/ `roots`（白名单，`--root` 持久化）/ `ignore`（额外忽略）/ `links`+`strictLinks`（check 自扫描关联 + 门禁）/ `rules` 表（10 规则 × `off|warn|error`，error=门禁 exit1）/ `hints`（规模阈值）。噪音边登记 `docs/map/memo/link-triage.md`（入库）豁免；文档卫生疤痕可用 `<!-- hygiene: ignore -->` 豁免。legacy 字段（strict/strictLinks/changelog/strictSemantics）首次运行自动迁移到 `rules`（configVersion 3），无需手改。

## 持续化原理

1. **init** 扫描真实目录 → 地图里只有真实存在的路径（无死链、不虚构）。
2. **sync** 是"地图更新"的自动化——像 `npm run build`，不靠人记得；粒度可配置，大项目自动降档。
3. **check + pre-commit** 提供强制力：地图断言引用已不存在文件 → 拦截 commit；规模/关联提示防"文档膨胀"与"跨模块漂移"。

## 迁移（v1 → v2 → v3）

用本版 `sync.mjs` 对旧地图跑一遍即迁移（职责行保留）；legacy 配置首次运行自动升级 v3 rules 表。升级粒度：改 `governance.json` 的 `level` 后 sync。完整演进史见 `CHANGELOG.md`。

## 已知边界 / 注意

- **tree 的职责描述**是人工/agent 维护的；files 级缺省 `(职责待填)`。
- **root 是模块级骨架**，「职责/影响/相关模块」待填。
- **配置文件**（package.json/.gitignore 等）进 root 视图，不进 tree。
- **关联闭环**：`links:true` 时 check 自带扫描器（绝对/相对/点风格/`<>`/Python import），出边+反向双向校验；`strictLinks` 可升级为门禁；噪音边用 `link-triage.md` 豁免。同模块内联（功能↔同目录展示层）检不到，需人工标注。
- 仅标准库，无第三方依赖；需要 Node.js 22+。
- init 不重写既有 CHANGELOG/AGENTS（保留并升级），不碰业务代码。