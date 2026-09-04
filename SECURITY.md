# Security Policy

## Supported Versions

本仓库是 DeepSeek Harness 插件，同时承载引擎源码（`engine/` 子目录，ADR-0002 单一仓库双目录；skill 目录为运行部署副本）。安全修复将策展到 `main` 分支与下一个插件版本。

| Version | Supported |
| --- | --- |
| main（开发期） | ✅ |
| 0.1.x | ✅（当前发布线） |

## Reporting a Vulnerability

请优先使用 GitHub 的 **Security Advisories**（私有漏洞报告），路径：

> Repository → **Security** → **Report a vulnerability**

报告请包含：

- 复现步骤（最小项目目录结构 + 命令序列）
- 影响面（是否涉及路径越界、命令注入、文档内容被篡改进 hook 等）
- 期望行为 vs 实际行为

**请勿在公开 Issue / Discussion 中披露未修复的漏洞细节。**

常规非安全缺陷（Bug / 功能请求）请提交到 [Issues](https://github.com/Fishsb/dsh-project-map-governance/issues)。

## 安全边界声明

- 引擎仅使用 Node 标准库，无第三方依赖面。
- `pre-commit` hook 由 `init` 写入项目 `.git/hooks/`，仅在本机执行 `check`；请审阅生成内容后再启用。
- 治理文档中的命令与规则会被 agent 阅读并执行——项目贡献者应像对待代码一样审查文档变更。
