# link-triage — 跨模块引用噪音豁免

> 登记被跨模块扫描器误判、确认不构成真实跨模块影响的引用边。
> 格式：`A → B — 原因`。check 读到本文件后不再提示/拦截这些边。

- `engine → src` — 噪音：lib-links.mjs 注释的 `#include <src/x.h>` 示例、smoke.mjs 测试创建的 `src/` 临时夹具目录名，非引擎真实依赖仓库 src 模块
- `engine → scripts` — 噪音：init.mjs/devref.mjs 代码中 `scripts/` 指引擎自身子目录（self-path），非仓库 `scripts/`（build.sh）模块
