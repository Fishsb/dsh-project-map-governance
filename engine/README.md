# project-map-governance 引擎（engine/）

项目地图 + 更新日志治理的**规则引擎**（Node 标准库，零第三方依赖），hook / CLI / DSH 插件 / MCP 四方共用同一事实源。

> **完整文档见 [`SKILL.md`](./SKILL.md)**（权威、单一事实源：设计/命令/配置/规则表/操作/边界）。
> 本 README 仅作快速入口，细节一律指向 SKILL.md——两处不同步时以 SKILL.md 为准。

## 快速入口

| 需要 | 看哪 |
|---|---|
| 这是什么 / 设计要点 | `SKILL.md` 核心心智 |
| 命令用法（init/sync/check/status/reconcile/adr/devref） | `SKILL.md` 三种操作 + 运行 |
| 配置 `governance.json` / 14 规则表 | `SKILL.md` 治理配置 + `governance.schema.json`（规则描述由 `lib-parse.mjs` RULE_DESC 生成，`scripts/gen-schema-check.mjs --fix` 重写） |
| 引擎版本演进 | [`CHANGELOG.md`](./CHANGELOG.md) |
| 回归测试 | `test/smoke.mjs`（用例数以运行输出为准：`node test/smoke.mjs`） |

## 位置与同步

- 本 `engine/` 目录 = 引擎源码（随插件仓 `dsh-project-map-governance` 分发，ADR-0002）
- 运行部署副本 = skill 目录（`C:\Users\lk\.dsh\skills\project-map-governance`）
- **改引擎后同步副本**：`bash engine/scripts/sync-copy.sh`（一键复制 + 一致性验证）

## 架构一览

```
engine/
├── SKILL.md                权威文档（设计/命令/规则/边界）
├── governance.schema.json  配置 schema（规则段可由 gen-schema-check 从 RULE_DESC 重写）
├── scripts/
│   ├── lib-parse.mjs       统一解析层 + 治理边界 + 规则注册（RULE_IDS/RULE_DESC/断言）
│   ├── lib-links.mjs       跨模块引用扫描器
│   ├── init / sync / check / adr / status / reconcile / devref  命令
│   ├── mcp-server.mjs      MCP stdio 薄包装
│   ├── gen-schema-check.mjs  规则注册一致性守护（schema vs RULE_IDS）
│   └── sync-copy.sh        引擎 → skill 副本同步
└── test/smoke.mjs          回归（用例数以运行输出为准）
```

## 变更纪律

1. 改引擎 → 回归 `test/smoke.mjs`（计数声明已去数字化：文档写「以运行输出为准」，勿再回填数字）
2. 加规则 → lib-parse `RULE_IDS`/`RULE_DESC`/`defaultRules` + check 规则块与断言 + `gen-schema-check.mjs --fix` + smoke 用例（check 启动会断言注册一致）
3. 同步副本 → `bash engine/scripts/sync-copy.sh`
4. 记录 → `CHANGELOG.md` [Unreleased] + 插件仓根 CHANGELOG
