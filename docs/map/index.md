# 项目地图 · dsh-project-map-governance-plugin

> dsh-project-map-governance 插件：DeepSeek Harness 原生治理工具包（SDK 原生 schema 校验 + Codis 上下文，派生工具链同构）。本文件是 LLM 友好导航（llms.txt 式）：先读这一句 + 导航，细节按链接按需取。

## 导航

- `src` — 见 root/src.md（Harness 插件入口与派生工具链，同构 SDK 上下文与 Codis 注入）
- `scripts` — 见 root/scripts.md（构建与素材管理（build.sh 等），源码无关）

## 治理

- [模块总览（含关联总图）](root.md)
- [文件级地图](tree/)（粒度：文件级（全量））
- [工程约定](conventions.md) — 按需创建（技术栈/命令/模式）
- [架构决策](decisions/README.md) — ADR 记录（新增：`node <skill>/scripts/adr.mjs . "<标题>"`）
- [更新日志](../CHANGELOG.md)

## Optional

- memo/ — 按需深挖的细节文档（关键符号/决策/坑）
- devref/ — 本地开发参考（gitignore 排除，不推 GitHub）
- 全量文件清单：不落盘；`node <skill>/scripts/sync.mjs . --list <模块>` 按需查看
