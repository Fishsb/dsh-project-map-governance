#!/bin/bash
# project-map-governance · sync-copy.sh
# 一键同步引擎（本仓 engine/）到 skill 运行副本（AGENTS.md 引用的部署位置）。
# 用法: bash engine/scripts/sync-copy.sh [目标skill目录]
# 缺省目标 = C:/Users/lk/.dsh/skills/project-map-governance（本机 skill 体系）
# 同步文件：scripts/*.mjs + SKILL.md + README.md + CHANGELOG.md + governance.schema.json + test/smoke.mjs
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"          # 本仓根（engine/scripts/sync-copy.sh → 上两级）
ENGINE="$REPO/engine"
SKILL="${1:-C:/Users/lk/.dsh/skills/project-map-governance}"

echo "=== 同步引擎 → skill 副本 ==="
echo "  源: $ENGINE"
echo "  目标: $SKILL"

mkdir -p "$SKILL/scripts" "$SKILL/test"

# 引擎脚本（全部 .mjs）
cp "$ENGINE/scripts/"*.mjs "$SKILL/scripts/"
# 引擎文档与 schema
cp "$ENGINE/SKILL.md" "$ENGINE/README.md" "$ENGINE/CHANGELOG.md" "$ENGINE/governance.schema.json" "$SKILL/"
# 回归测试
cp "$ENGINE/test/smoke.mjs" "$SKILL/test/"
echo "  ✓ 已复制 $(ls "$ENGINE/scripts/"*.mjs | wc -l) 个脚本 + 4 文档 + schema + smoke"

# 一致性验证
echo "=== 一致性验证 ==="
FAIL=0
for f in "$ENGINE"/scripts/*.mjs; do
  base="$(basename "$f")"
  diff -q "$f" "$SKILL/scripts/$base" >/dev/null || { echo "  ✗ DIFF scripts/$base"; FAIL=1; }
done
for f in SKILL.md README.md CHANGELOG.md governance.schema.json; do
  diff -q "$ENGINE/$f" "$SKILL/$f" >/dev/null || { echo "  ✗ DIFF $f"; FAIL=1; }
done
diff -q "$ENGINE/test/smoke.mjs" "$SKILL/test/smoke.mjs" >/dev/null || { echo "  ✗ DIFF test/smoke.mjs"; FAIL=1; }
if [ "$FAIL" = "0" ]; then echo "  ✅ 全部一致"; else echo "  ⛔ 有差异（见上）"; exit 1; fi

echo "=== 完成：引擎已同步到 $SKILL ==="
