# 文件索引 · engine

> 由 sync.mjs 自动同步（职责为人工维护）。粒度 files：全量文件登记。

- `engine/CHANGELOG.md` — (7.9 KB) 引擎演进史（v1→v3 规则引擎），随 skill 副本同步
- `engine/governance.schema.json` — (5.5 KB) 治理配置 schema（rules 段由 gen-schema-check 从 RULE_DESC 生成）
- `engine/README.md` — (2.5 KB) 引擎快速入口（细节指向 SKILL.md，双入口防不同步）
- `engine/scripts/adr.mjs` — (3.0 KB) ADR 捕获：模板新建 ADR-NNNN + 登记 decisions/README 索引
- `engine/scripts/check.mjs` — (26.0 KB) 规则引擎主命令：14 规则块 + severity 分级 + --json 结构化
- `engine/scripts/devref.mjs` — (8.2 KB) 官方开发参考文档部署（manifest 拉取，本地不入库）
- `engine/scripts/gen-schema-check.mjs` — (1.8 KB) schema rules 与 RULE_IDS 一致性守护（--fix 重写）
- `engine/scripts/init.mjs` — (24.1 KB) 治理初始化：AGENTS/CLAUDE/docs/map/hook/facts 模板生成
- `engine/scripts/lib-links.mjs` — (2.7 KB) 跨模块引用扫描器（相对/绝对/点风格/`<>`/Python import）
- `engine/scripts/lib-parse.mjs` — (20.0 KB) 统一解析层+治理边界+规则注册（RULE_IDS/RULE_DESC 单一源）
- `engine/scripts/mcp-server.mjs` — (5.1 KB) MCP stdio 薄包装（其他 agent 复用同套引擎）
- `engine/scripts/reconcile.mjs` — (4.5 KB) 文档卫生：mtime/疤痕/超期驱动重读清单 + --done 基线
- `engine/scripts/status.mjs` — (3.4 KB) 治理状态快照（配置/粒度/模块/ADR/reconcile 天数）
- `engine/scripts/sync-copy.sh` — (1.7 KB) 引擎→skill 部署副本一键同步+一致性验证
- `engine/scripts/sync.mjs` — (15.1 KB) 地图同步：tree 按粒度刷新+root.md 派生表+index 对齐
- `engine/SKILL.md` — (18.0 KB) 引擎权威文档（设计/命令/配置/规则/边界）
- `engine/test/smoke.mjs` — (37.9 KB) 引擎回归（24 组用例，用例数以运行输出为准）
