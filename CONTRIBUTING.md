# 贡献指南（CONTRIBUTING）

欢迎贡献！请遵循 DeepSeek Harness 插件生态的既有约定。

## 架构约定（重要）

本仓库是**薄契约层**，业务逻辑在**引擎**（`scripts/*.mjs`，随 skill 目录维护）：

```
src/index.ts          ← 插件契约：把引擎命令注册为 DSH 原生工具
scripts/build.sh      ← 构建（tsc + vendor 依赖，需 DSH 源码 checkout）
lib/                  ← 编译产物（.gitignore，不入库；无 checkout 时与 src 手动同步）
引擎 scripts/*.mjs    ← 规则/解析/命令的单一事实源（在 skill 目录，不在本仓库）
```

修改任何工具行为，优先改**引擎**；本仓库只改工具注册与文档。

## 本地构建与注入

```powershell
$env:DSH_CHECKOUT = "C:\path\to\dsh\source"
bash scripts/build.sh            # 编译 src → lib
# Harness 会话内注入：
dev_inject_plugin <本目录>        # 热注入，免重启
# 或标准安装：
dsh plugin --profile web add <本目录>
```

**无 DSH 源码 checkout** 时：手动更新 `lib/index.js` 使其与 `src/index.ts` 一一对应（本仓库初始 lib 即为此法生成）。

## 测试

- 引擎回归：`node test/smoke.mjs`（84 用例，引擎自带，覆盖三档粒度/迁移/门禁/ADR/卫生）
- 契约冒烟：注入后在 Harness 会话实测 `init → sync → check --json → status` 链路
- 提交前务必跑一遍引擎回归，确认无回归。

## 提交与 PR 约定

- **Conventional Commits**：`feat:` / `fix:` / `docs:` / `chore:` / `refactor:` 前缀
- 用户可见变更 → 更新 `CHANGELOG.md`
- README 变更 → 中英双语同步（`README.md` / `README.en.md`）
- 本仓库版本与引擎版本解耦；发版节奏见 `SECURITY.md` / 维护者决定

## 分支与合并

- PR 建到 `main`；合并用 squash merge，PR 标题即 commit message。
- 保持 commit 小而聚焦；涉及引擎行为变化请附引擎回归结果。

## 行为准则

见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
