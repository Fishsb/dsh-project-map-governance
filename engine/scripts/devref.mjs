#!/usr/bin/env node
// project-map-governance · devref.mjs
// 部署开发参考文档（init 之后推荐执行）：
//   按 manifest 从官方源拉取开发文档 → 写入 <项目>/<dir>/ → 登记进项目地图
//   （tree/files.md + index.md + AGENTS.md + root.md）→ .gitignore 本地化（不推 GitHub）→ 跑 check。
//
// 政策（用户约定）：
//   - GitHub 只发布「功能实现文档 + 说明文档」；开发参考文档本地一份、不入库。
//   - 开发参考文档纳入治理地图：任何 agent 开工读地图即可发现。
//
// 用法: node devref.mjs <项目路径> <manifest.json>
// manifest.json:
//   {
//     "dir": "docs/devref",                              // 可选，默认 docs/devref
//     "docs": [
//       { "name": "xxx.md", "url": "https://...", "note": "一句话说明" }
//     ]
//   }
//   url 支持：GitHub contents API（自动 base64 解码）或任意文本 URL。
//   幂等：已登记的文件/地图行不会重复写入；改 manifest 重跑即可增量。
//
// 退出码: 0=成功  1=拉取/登记失败  2=参数错误
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.error('用法: node devref.mjs <项目路径> <manifest.json>');
  process.exit(2);
}

function parseArgs(argv) {
  const args = { target: null, manifest: null };
  for (const a of argv) {
    if (a.startsWith('--')) { console.error(`未知参数: ${a}`); usage(); }
    else if (!args.target) args.target = a;
    else if (!args.manifest) args.manifest = a;
    else usage();
  }
  return args;
}

async function fetchDoc(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'dsh-devref' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const text = await res.text();
  if (url.includes('api.github.com') && url.includes('/contents/')) {
    try {
      const j = JSON.parse(text);
      if (j && typeof j.content === 'string') {
        return Buffer.from(j.content.replace(/\s/g, ''), 'base64').toString('utf8');
      }
    } catch { /* 非 JSON 按纯文本处理 */ }
  }
  return text;
}

// ---- 地图登记（幂等）----

function ensureLine(file, needle, insert, after = false) {
  // needle 已存在 → 不动；否则在文件尾（或指定行后）插入
  if (!fs.existsSync(file)) return false;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes(needle)) return false;
  if (after) {
    const idx = content.indexOf(after);
    if (idx < 0) { content += insert; }
    else { content = content.slice(0, idx + after.length) + insert + content.slice(idx + after.length); }
  } else {
    content += insert;
  }
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

function registerTree(project, dir, docs) {
  const file = path.join(project, 'docs', 'map', 'tree', 'files.md');
  let content;
  if (!fs.existsSync(file)) {
    content = '# 文件索引 · 开发参考\n\n';
    fs.mkdirSync(path.dirname(file), { recursive: true });
  } else content = fs.readFileSync(file, 'utf8');
  const section = '## 开发参考（本地治理，不入库）';
  const rows = docs
    .map((d) => `| \`${dir}/${d.name}\` | ${d.note} | 开发/排障必读 |`)
    .join('\n');
  if (!content.includes(section)) {
    content += `\n${section}\n\n> 官方开发参考文档：随 devref 环节部署，本地一份，gitignore 排除，不推 GitHub。\n\n| 文件 | 职责 | 关联 |\n|---|---|---|\n${rows}\n`;
  } else {
    // 追加到该 section 下第一个表格末尾：直接在 section 之后补行（幂等由 ensureLine 保证）
    const extra = docs.filter((d) => !content.includes(`${dir}/${d.name}`))
      .map((d) => `| \`${dir}/${d.name}\` | ${d.note} | 开发/排障必读 |`)
      .join('\n');
    if (extra) {
      // 插到该 section 表格最后一行后
      const endRow = content.lastIndexOf('|---|') >= 0 ? content.indexOf('\n', content.lastIndexOf('|---|')) : -1;
      const insertAt = endRow >= 0 ? endRow + 1 : content.length;
      content = content.slice(0, insertAt) + extra + '\n' + content.slice(insertAt);
    }
  }
  fs.writeFileSync(file, content, 'utf8');
}

function registerIndex(project, dir, docs) {
  // v2 index.md 为 llms.txt 式：登记进「## Optional」区（llms.txt 惯例：可跳过内容）；缺失则创建该区。
  const file = path.join(project, 'docs', 'map', 'index.md');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  const items = docs
    .filter((d) => !content.includes(`${dir}/${d.name}`))
    .map((d) => `- [开发参考：${d.note}](../../${dir}/${d.name}): ${d.name}`)
    .join('\n');
  if (!items) return;
  if (content.includes('## Optional')) {
    const headAt = content.indexOf('## Optional');
    // 插到 Optional 区块末尾（下一个 '## ' 或文件尾）
    const nextHead = content.indexOf('\n## ', headAt + 1);
    const insertAt = nextHead >= 0 ? nextHead + 1 : content.length;
    content = content.slice(0, insertAt) + items + '\n' + content.slice(insertAt);
  } else {
    content += `\n## Optional\n\n${items}\n`;
  }
  fs.writeFileSync(file, content, 'utf8');
}

function registerAgents(project, dir, docs) {
  const file = path.join(project, 'AGENTS.md');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  const marker = '└── docs/map/';
  if (!content.includes(marker)) return;
  const lines = docs
    .filter((d) => !content.includes(`${dir}/${d.name}`))
    .map((d) => `├── ${dir}/${d.name}   ${d.note}`);
  if (!lines.length) return;
  content = content.replace(marker, lines.join('\n') + '\n' + marker);
  fs.writeFileSync(file, content, 'utf8');
}

function ensureGitIgnore(project, dir) {
  const file = path.join(project, '.gitignore');
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(`${dir}/`)) return;
  const block = `\n# ---- 开发参考文档（本地管理用，不推 GitHub）----\n${dir}/\n`;
  fs.appendFileSync(file, block, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = path.resolve(args.target || '');
  if (!args.target || !args.manifest || !fs.existsSync(target)) usage();
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8').replace(/^\uFEFF/, '')); // 容错 UTF-8 BOM
  } catch (e) {
    console.error(`manifest 读取失败: ${e.message}`);
    process.exit(2);
  }
  const dir = (manifest.dir || 'docs/devref').replace(/^\/+|\/+$/g, '');
  const docs = Array.isArray(manifest.docs) ? manifest.docs : [];
  if (!docs.length) { console.error('manifest.docs 为空'); process.exit(2); }

  const destDir = path.join(target, dir);
  fs.mkdirSync(destDir, { recursive: true });
  let ok = 0, failed = 0;
  for (const d of docs) {
    const dest = path.join(destDir, d.name);
    try {
      const content = await fetchDoc(d.url);
      fs.writeFileSync(dest, content, 'utf8');
      console.log(`  ✓ ${dir}/${d.name} (${Buffer.byteLength(content)} bytes)`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${d.name}: ${e.message}`);
      failed++;
    }
  }
  if (!ok) { console.error(`❌ 全部拉取失败（${failed} 个），未登记地图。`); process.exit(1); }

  const done = docs.filter((d) => fs.existsSync(path.join(destDir, d.name)));
  registerTree(target, dir, done);
  registerIndex(target, dir, done);
  registerAgents(target, dir, done);
  // 注意：root.md 模块表由 sync 从 root/<模块>.md 派生，devref 不再写 root.md（避免覆盖生成区）。
  ensureGitIgnore(target, dir);

  console.log(`\n✅ devref 完成：${ok} 个文档 → ${target}\\${dir}\\`);
  console.log('   已登记：docs/map/tree/files.md · docs/map/index.md · AGENTS.md · docs/map/root.md');
  console.log(`   已 gitignore：${dir}/（本地治理，不推 GitHub）`);
  if (failed) console.log(`⚠ ${failed} 个拉取失败，已跳过（可修复 manifest 后重跑，幂等）。`);

  const check = spawnSync(process.execPath, [path.join(SKILL_DIR, 'scripts', 'check.mjs'), target], { stdio: 'inherit' });
  process.exit(check.status ?? 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
