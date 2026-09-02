# 项目地图 · dsh-project-map-governance-plugin

> dsh-project-map-governance：DeepSeek Harness 原生**项目地图 + 更新日志治理**工具包（规则引擎化 check，AGENTS/docs/map 防漂移）。本仓库是引擎的**插件薄契约层**——把 skill 目录的 6 个治理脚本注册为 DSH 原生工具；引擎（单一事实源）随 skill 目录独立演进。本文件是 LLM 友好导航（llms.txt 式）：先读这一句 + 导航，细节按链接按需取。

## 导航

- `src` — 见 root/src.md（Harness 插件入口与派生工具链，同构 SDK 上下文与 Codis 注入）
- `scripts` — 见 root/scripts.md（构建与素材管理（build.sh 等），源码无关）

## 治理

- [模块总览（含关联总图）](root.md)
- [文件级地图](tree/)（粒度：文件级（全量））
- [工程约定](conventions.md) — 按需创建（技术栈/命令/模式）
- [架构决策](decisions/README.md) — ADR 记录（新增：`node <skill>/scripts/adr.mjs . "<标题>"`）
- [更新日志](../CHANGELOG.md)

> **地图边界**：按引擎约定，根级通用文档（AGENTS/CLAUDE/README/CHANGELOG/LICENSE/CONTRIBUTING/CODE_OF_CONDUCT）与根级配置文件（package.json/tsconfig.json 等）不入 tree 登记；前者见仓库根，后者见 `root/package_json.md`、`root/tsconfig_json.md`（语义字段待人工/agent 补充）。

## Optional

- memo/ — 按需深挖的细节文档（关键符号/决策/坑）
- devref/ — 本地开发参考（gitignore 排除，不推 GitHub）
- 全量文件清单：不落盘；`node <skill>/scripts/sync.mjs . --list <模块>` 按需查看
