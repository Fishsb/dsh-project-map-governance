---
name: project-map-governance
description: "新建项目地图（init/sync/verify the project-map + changelog governance scheme in a project workspace）. Use when the user wants to set up, refresh, or enforce a governance layer for vibe/AI coding on a project: generate AGENTS.md + docs/map (root/tree/flow) by scanning the real repo, auto-sync the map after code changes, deploy official dev-reference docs into the map (devref), and install a pre-commit hook that blocks map drift. Triggers include: 新建项目地图、建立项目地图、初始化治理、治理方案、同步地图、检查地图漂移、设置管控、部署开发参考文档、开发参考文档、devref、project map governance、codebase map、AGENTS 生成、地图同步、地图漂移检查、vibe coding 治理."
agent_created: true
---

# project-map-governance — 项目地图 + 更新日志治理（v3，规则引擎）

为 vibe/AI coding 项目落地「项目地图 + 更新日志」双文档治理，并让它**可持续、可缩放**：
skill 生成的不是静态文档，而是**能自检的机制**（扫描→生成→同步→check 强制防漂移 + 规模/关联审查提示）。

本 skill 在 DSH 环境中以 **Node.js 实现**（标准库，无第三方依赖），针对用户指定的项目目录操作。

## 核心心智（信息类主辅分离 + 渐进披露 + 关联层；v3 规则引擎化）

| 方案 | 说明 |
|---|---|
| **信息类分离** | 主文档按「一个文档一个主题」组织（项目摘要/模块地图/关键文件/约定/决策），模块只是模块地图内的二级分组——同 managing-memory 按画像/记忆/教训分类的做法 |
| **披露层级** | L0 常读（AGENTS.md + index.md，≤~80 行）→ L1 按任务（root/tree/conventions）→ L2 按需（memo/）；细节永远在链接后面，按需取 |
| **模块关联层** | 每模块文档有「相关模块」节；`sync --links` / check 自扫描（共用 `lib-links.mjs` 扫描器，含相对导入解析）探测跨模块引用；check 对"代码有引用但地图无标记"提示（出边+反向双向），可升级 strictLinks 门禁；噪音边可登记 `docs/map/memo/link-triage.md` 豁免（入库、随仓库走） |
| **规模审查** | check 顺带当 linter：主文档 >200 行 / index 模块 >15 项 / 单模块关键文件 >100 个 → 非阻塞提示拆分；粒度 files→dirs→modules 自动降档 |
| **生态兼容** | AGENTS.md + CLAUDE.md 双写（Claude Code 自动读）；index.md 为 llms.txt 式（H1 + 摘要 + 导航/治理 + `## Optional`），可机器解析 |

**治理工作量与项目规模解耦**：机器成本可忽略（15k 文件 check ~0.15s）；地图体积由"全量清单"降为"精选索引"，维护量为 O(模块数 + 关键文件数)。

## 何时使用 / 触发词

- 「**新建项目地图**」「建立项目地图」「初始化治理」「给这个项目加管控」→ **init**（生成整套治理）
- 「同步地图」「更新项目地图」→ **sync**（改动后刷新 tree；`--links` 探测跨模块关联）
- 「检查漂移」「验证地图」→ **check**（commit 前校验 + 规模/关联审查提示）
- 「**部署开发参考文档**」「配置开发参考」「devref」→ **init 之后执行 devref**
- 「接入新项目用这套治理」→ **init** 到新项目目录（建议接着做 devref）

## 三种操作（+ 一个扩展）

### 1. init — 在项目里初始化治理

扫描指定项目目录的真实结构，生成：

- `AGENTS.md`（收缩版：一句话描述 + 地图指针 + 3 条规则）+ `CLAUDE.md`（同内容，Claude Code 兼容）
- `docs/map/index.md`（llms.txt 式总导航）`+ root.md`（模块总览/关联总图）+ `root/<模块>.md`（职责 + **相关模块**）
- `docs/map/tree/<模块>.md`（按粒度）+ `docs/map/governance.json`（治理配置）
- `CHANGELOG.md`（若已有则保留，否则建 Keep-a-Changelog 模板）
- git 仓库时安装 `.git/hooks/pre-commit` → 自动跑 check（strict 与否由配置决定）

```
init <项目路径> [--root 模块目录名,逗号分隔] [--level files|dirs|modules] [--links] [--strict-links] [--changelog] [--strict-semantics] [--no-hook] [--force] [--hook-only]
```

- `<项目路径>` 必填
- `--root`：白名单（只治理这些顶层模块），**持久化进 governance.json**，sync/check 同源生效
- `--level`：粒度 files（全量）/ dirs（目录骨架+关键文件）/ modules（纯模块级）；缺省按文件数自动：<500 文件→files，500~2000→dirs，>2000→modules
- `--links` / `--strict-links`：开启跨模块引用探测 / 并把缺标记升级为门禁
- `--changelog`：开启 CHANGELOG 门禁（config.changelog="required"）
- `--strict-semantics`：root/*.md 语义字段仍（待填）→ 拦截

init 还生成 `docs/map/decisions/`（ADR 骨架，单一事实源 = ADR-NNNN.md）与 `root.md` 派生表标记（表由 sync 从 root/<模块>.md 汇总，**勿手改标记区间**）。

### 2. sync — 改动后同步地图（配置驱动）

重新扫描并重写治理范围内的 tree + 派生文档：

- **files 级**：全量登记（保留人工行尾职责；兼容旧版裸文件名条目）
- **dirs 级**：目录骨架 + 有关键职责注记的文件；未登记文件给统计行
- **modules 级**：仅文件数统计（树不再膨胀）
- **root.md 模块表汇总**：从 root/<模块>.md 的 职责/负责/相关模块 重建（消灭双写漂移）
- **index 导航 reconcile**：模块一览与实际不符 → 提示；`--reindex` 直接刷新
- `--list <模块>`：把指定模块**全量清单打到 stdout（不落盘）**——dirs/modules 粒度下按需看全景
- `--links`：跨模块引用（含相对导入）候选 → `.internal/link-candidates.txt`（人工确认后填 root/*.md「相关模块」，噪音登记 link-triage.md）
- 治理边界与 check 一致：`docs/`、`.internal/`、`assets/` 整体不入图；配置文件与二进制媒体忽略；白名单外模块不治理

```
sync <项目路径> [--links] [--list <模块>] [--reindex]
```

### 3. check — 校验地图不漂移 + 审查提示（commit 前自动）

- **核心**（任何粒度）：地图引用的文件不存在 → 漂移（报错，拦截）
- **strict**（默认由 governance.json 决定，files 粒度下生效）：未登记的新文件 → 漂移
- **门禁（配置开启）**：
  - `strictLinks`：跨模块关联缺标记 → 拦截（triage 可豁免）
  - `changelog="required"`：自上次 tag 有功能提交但 [Unreleased] 无实质条目 → 拦截
  - `strictSemantics`：root/*.md 职责/负责/影响仍（待填）→ 拦截
- **审查提示**（非阻塞，linter 式；阈值可配 `governance.json.hints`）：
  - 📏 主文档 >阈值 行 → 建议拆分到 memo/；index 模块一览 >阈值 → 建议按域聚合；单模块关键文件 >阈值 → 建议下钻（默认 200/15/100）
  - 🔗 关联守恒（`links=true` 时**自扫描**，出边+反向双向）：代码跨模块引用但「相关模块」无标记 → 提示补关联
  - 📚 语义/一致性：root.md 派生表与 root/<模块>.md 不一致、index 导航与实际模块不符、语义字段待补全
  - 🧹 文档卫生：docs/map 内语义陈旧疤痕（corrected/reversed/TODO/⚠/过时 等）→ 建议 reconcile 重读（`<!-- hygiene: ignore -->` 可豁免）
  - 📐 index.md 缺 H1/摘要 → 提示补 llms.txt 式头
- **噪音豁免**：确认为噪音的候选边登记 `docs/map/memo/link-triage.md`（`- A → B — 原因`）
- 退出码：`0` 一致（可带提示）/ `1` 漂移 / `2` 参数错误

```
check <项目路径> [--strict]
```

### 4. adr — 架构决策记录捕获（重大决策必须落盘）

```
adr <项目路径> "<决策标题>" [--status proposed|accepted]
```

自动编号 `docs/map/decisions/ADR-NNNN.md`（模板含 背景/决策/后果/替代方案/状态/日期）并登记 `decisions/README.md` 索引。AGENTS.md 规则要求：重大架构/技术决策 → 必须记 ADR。

### 5. devref — 部署开发参考文档（init 之后推荐执行）

把「官方开发参考文档」作为项目治理的一部分部署：**本地一份、不入库**，并登记进地图（tree/files.md + index.md `## Optional` 区 + AGENTS.md）。root.md 已改为 sync 派生，devref 不再写入。

**Agent 执行流程**：提问（项目/技术栈/部署环境）→ 检索官方文档候选 → 用户勾选确认 → 写 manifest.json → `devref.mjs` 拉取 + 登记 → 汇报。

```
devref <项目路径> <manifest.json>
```

manifest：`{ "dir": "docs/devref", "docs": [{ "name", "url", "note" }] }`；url 支持 GitHub contents API（自动 base64 解码）或任意文本 URL；幂等可增量重跑。**政策红线**：开发参考文档不进 GitHub（gitignore 强制）。

## 治理配置 `docs/map/governance.json`

```json
{
  "configVersion": 3,          // 规则模型（v3）；legacy 字段由 lib-parse 自动迁移
  "generatedBy": "project-map-governance/init.mjs v3",
  "level": "files",            // files | dirs | modules（init 自动选或 --level 指定）
  "roots": ["src", "lib"],     // 白名单（--root 时写入）；缺省 = 全部顶层目录
  "ignore": [],                // 额外忽略的顶层目录名
  "links": true,               // true=check 自扫描跨模块引用（闭环随 hook 存在）
  "autoLevel": { "files": 500, "dirs": 2000 },   // 自动降档阈值（可配）
  "rules": {                   // 规则表（severity: off|warn|error；error=门禁 exit1）
    "dead-links": "error",         // 地图引用不存在文件（核心，恒 error）
    "untracked-strict": "off",     // files 粒度下未登记新文件
    "relatedness": "warn",         // 跨模块关联缺「相关模块」标记（出边+反向；triage 豁免）
    "changelog": "off",            // CHANGELOG 门禁（自上次 tag 有功能提交但 Unreleased 无实质条目）
    "semantics": "warn",           // root/*.md 职责/负责/影响 待填
    "size": "warn",                // 规模审查（阈值见 hints）
    "root-consistency": "warn",    // root.md 派生表 vs 模块节一致性
    "index-consistency": "warn",   // index.md 导航 vs 真实模块
    "index-format": "warn",        // llms.txt 式 H1+摘要
    "doc-hygiene": "warn"          // 语义陈旧疤痕（corrected/reversed/TODO/⚠/过时…；豁免标记豁免）
  },
  "hints": { "maxDocLines": 200, "maxIndexModules": 15, "maxTreeNoted": 100 }
}
```

> **关联闭环语义**：`links:true` 时 check 自带扫描器（`lib-links.mjs`，支持绝对/相对/点风格/`<>`/Python import），不再依赖 `.internal/` 瞬态文件——新鲜克隆后 hook 依然守得住。`sync --links` 仍是人工预览工具（候选写 `.internal/` 不入库）。噪音边登记 `docs/map/memo/link-triage.md`（入库）豁免。
> **派生文档**：`root.md` 模块表（职责/负责/相关模块）由 sync 从 root/<模块>.md 汇总，标记区间勿手改；手改会被 check 一致性提示。**ADR**：重大决策用 `adr.mjs` 落盘到 decisions/。**文档卫生**：check 扫描语义陈旧疤痕并建议 reconcile（`<!-- hygiene: ignore -->` 豁免）。

## 运行

```powershell
node "<skill-dir>/scripts/init.mjs"   <项目路径> [--root ...] [--level files|dirs|modules] [--links] [--strict-links] [--changelog] [--strict-semantics]
node "<skill-dir>/scripts/sync.mjs"   <项目路径> [--links] [--list <模块>] [--reindex]
node "<skill-dir>/scripts/check.mjs"  <项目路径> [--strict] [--json]    # --json 结构化输出（插件/MCP 用）
node "<skill-dir>/scripts/status.mjs" <项目路径> [--json]               # 状态快照
node "<skill-dir>/scripts/adr.mjs"    <项目路径> "<决策标题>" [--status accepted]
node "<skill-dir>/scripts/reconcile.mjs" <项目路径> [--days 30] [--done] [--json]
node "<skill-dir>/scripts/devref.mjs" <项目路径> <manifest.json>         # init 之后推荐
node "<skill-dir>/scripts/mcp-server.mjs"                               # MCP stdio 服务（其他 agent 用）
```

> **规则模型（v3）**：`governance.json.rules` 每条规则 severity = off|warn|error；error 级触发 pre-commit 拦截（exit 1），warn = 提示。legacy 配置（strict/strictLinks/changelog/strictSemantics）首次运行自动迁移为 rules（configVersion 3），无需手改。

## 形态与集成（引擎不变，三层契约）

| 形态 | 位置 | 用途 |
|---|---|---|
| **脚本引擎** | `scripts/*.mjs` | pre-commit hook 与本机 CLI；任何 agent 可 `node ...` 调用 |
| **DSH 插件**（toolkit） | `~/.dsh/plugins/project-map-governance` | 把 6 个工具注册为 DSH **原生工具**（init/sync/check/adr/status/reconcile，check 结构化返回）；`dev_inject_plugin` 注入即用 |
| **MCP 服务**（可选） | `scripts/mcp-server.mjs` | 供其他 MCP agent（如 Claude Code：`claude mcp add project-map-governance -- node <skill>/scripts/mcp-server.mjs`） |

> 注入/构建说明：插件 `lib/` 已含产物（本机无 DSH 源码 checkout 时手工编译）；有 checkout 的环境用 `scripts/build.sh`（dev_scaffold_plugin 生成）重新编译。三方共享同一引擎，行为一致。

> `<skill-dir>` = `C:\Users\lk\.dsh\skills\project-map-governance`（运行部署副本）
> **引擎源码仓** = `D:\FF\dsh-project-map-governance-engine`（git 版本控制 + 自治理 self-hosting：AGENTS/docs/map + pre-commit；改动引擎先改源码仓 → 回归 `test/smoke.mjs` → 同步本 skill 副本）。
> **v3（2026-09-02）**：架构根治 + 形态升级——规则引擎化（`rules` 表 + severity + `--json`）、`governance.schema.json` 语义（configVersion 自动迁移）、`lib-parse` 统一解析层、`autoLevel` 阈值配置、`status/reconcile` 命令、内置 `test/smoke.mjs`（84 用例）、DSH 插件（6 个原生工具）与 MCP 薄包装。引擎即单一事实源，hook / 插件 / MCP 三方共用。
> **v2.2 / v2.1 / v2**：见上（信息类主辅分离、披露层级、关联闭环、语义门禁等）。**v1 地图迁移**：任意版本 `sync.mjs` 跑一遍即自动按配置重写 tree（职责保留）；配置首次运行自动升级到 v3。
> 退出码约定：`0` 成功/一致，`1` 失败/漂移，`2` 参数错误。

## pre-commit hook（init 时自动安装到项目 .git/hooks/）

hook 调 `check.mjs`（strict/strictLinks 由 governance.json 决定），若地图漂移则拦截 commit 并提示先 `sync`。可手动卸载（删除该文件）或用 `--no-hook` 跳过安装。

## 依赖

- Node.js 22+（DSH 自带；仅标准库，无第三方安装）
- 目标项目须是 git 仓库（hook 装到 `.git/hooks/`；非 git 仍可用 init/sync，但不装 hook）

## 设计原则

- **不重写既有资产**：项目已有 CHANGELOG/AGENTS 时保留并升级，不推倒。
- **不虚构路径**：地图里的每个文件都是 init/sync 扫描真实目录得到的，无死链（check 强制）。
- **最小侵入**：只新增治理文件 + 一个 hook，不碰业务代码；`.internal/` 瞬态数据 gitignore。
- **精选而非全量**：治理文档只放精选信息（方向/关键点/关联面），全量清单按需生成（`sync --list` / grep）。

## 已知边界

- **同模块内联检不到**：跨模块引用探测是模块级粒度；同一模块内的耦合（如功能逻辑与同目录展示层）不会触发关联提示——此类关键耦合请人工写进 `root/<模块>.md`「相关模块」或 `memo/`。
- **关联扫描成本**：`links:true` 时 check 每次读取治理范围内文件内容（上限：每模块 4000 文件 × 256KB × 前 20k 字符）；大仓库如需极致 commit 速度可关闭 links 只留死链门禁。