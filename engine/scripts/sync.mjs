#!/usr/bin/env node
// project-map-governance · sync.mjs（v2，2026-09-01）
// 改动代码后刷新项目地图（配置驱动）：
//   - 读取 docs/map/governance.json（level/roots/ignore/links）；缺省 = v1 行为（全量 files 级）
//   - tree/<模块>.md 按粒度渲染：files（全量）/ dirs（目录骨架+关键文件）/ modules（仅统计）
//   - 保留行尾「职责」注记；兼容旧版裸文件名条目（自动按去模块前缀匹配）
//   - --links：跨模块引用探测 → 候选写入 .internal/link-candidates.txt（check 据此给关联守恒提示）
//   - --list <模块>：把该模块全量清单打到 stdout（不落盘，dirs/modules 粒度下按需全景）
// 用法: node sync.mjs <项目路径> [--links] [--list <模块>]
import fs from 'node:fs';
import path from 'node:path';
import { findCrossModuleLinks } from './lib-links.mjs';
import * as P from './lib-parse.mjs';

function usage() { console.error('用法: node sync.mjs <项目路径> [--links] [--list <模块>] [--reindex]'); process.exit(2); }

function parseArgs(argv) {
  const args = { links: false, list: null, reindex: false, target: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--links') args.links = true;
    else if (a === '--reindex') args.reindex = true;
    else if (a === '--list') args.list = argv[++i] || '';
    else if (a.startsWith('--')) { console.error(`未知参数: ${a}`); usage(); }
    else if (!args.target) args.target = a;
    else usage();
  }
  return args;
}

// ---- 治理边界（与 check.mjs / init.mjs 同代配套）----
const IGNORE_NAMES = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__', '.venv', 'venv', '.cache', '.next', 'target', 'docs', '.internal', 'assets']);
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.tar', '.gz', '.zip', '.exe', '.dll', '.bin']);
const isCfgFile = (n) => /^\.?[a-zA-Z0-9_\-]+\.(json|ya?ml|toml|ini|cfg|lock)$/.test(n);
const ROOT_DOC = new Set(['AGENTS.md', 'CLAUDE.md', 'CHANGELOG.md', 'README.md', 'README.en.md', 'LICENSE', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md']);
const PROTECTED_TREE = new Set(['index', 'files', 'root-files']);
const human = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

const args = parseArgs(process.argv.slice(2));
if (!args.target) usage();
const target = path.resolve(args.target);
if (!fs.existsSync(target)) usage();
const config = P.loadConfig(target); // v3：legacy 字段自动迁移并落盘
const level = ['files', 'dirs', 'modules'].includes(config.level) ? config.level : 'files';
const extraIgnore = new Set(Array.isArray(config.ignore) ? config.ignore : []);

// 治理范围：roots 白名单（若有）→ 至少含白名单；否则全部顶层目录
function governedDirs() {
  const roots = Array.isArray(config.roots) && config.roots.length ? config.roots : null;
  const out = [];
  let entries; try { entries = fs.readdirSync(target, { withFileTypes: true }); } catch { entries = []; }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (IGNORE_NAMES.has(ent.name) || extraIgnore.has(ent.name) || ent.name.startsWith('.')) continue;
    if (roots && !roots.includes(ent.name)) continue;
    out.push(ent.name);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function scanFiles(dir, prefix = '') {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const ent of entries) {
    if (IGNORE_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) { out.push(...scanFiles(full, rel)); continue; }
    if (isCfgFile(ent.name) || BINARY_EXT.has(path.extname(ent.name).toLowerCase())) continue;
    let size = 0; try { size = fs.statSync(full).size; } catch {}
    out.push({ path: rel, size });
  }
  return out;
}

function scanDirsWithCounts(root, prefix = '') {
  // 目录骨架：dirs: [{path, files}]
  const dirs = [];
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return dirs; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const ent of entries) {
    if (IGNORE_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    const full = path.join(root, ent.name);
    if (ent.isDirectory()) {
      const all = collectFiles(full);
      dirs.push({ path: rel, files: all.length });
      dirs.push(...scanDirsWithCounts(full, rel));
    }
  }
  return dirs;
}

function collectFiles(dir) {
  return scanFiles(dir);
}

function loadNotes(treeFile) {
  const notes = new Map();
  try {
    for (const line of fs.readFileSync(treeFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^- `([^`]+)` — (?:\([^)]*\) )?(.*)$/);
      if (!m || !m[2].trim()) continue;
      notes.set(m[1], m[2].trim());
      if (m[1].includes('/')) {
        const alias = m[1].slice(m[1].indexOf('/') + 1);
        if (!notes.has(`@bare:${alias}`)) notes.set(`@bare:${alias}`, m[2].trim());
      } else notes.set(`@bare:${m[1]}`, m[2].trim());
    }
  } catch {}
  return notes;
}

function noteOf(notes, p) {
  if (notes.has(p)) return notes.get(p);
  const bare = p.includes('/') ? p.slice(p.indexOf('/') + 1) : null;
  if (bare && notes.has(`@bare:${bare}`)) return notes.get(`@bare:${bare}`);
  return '';
}

// ---- 渲染（按粒度）----
function renderFiles(title, files, notes) {
  const lines = [`# 文件索引 · ${title}`, '', '> 由 sync.mjs 自动同步（职责为人工维护）。粒度 files：全量文件登记。', ''];
  for (const f of files) lines.push(`- \`${f.path}\` — (${human(f.size)}) ${noteOf(notes, f.path) || '(职责待填)'}`);
  if (!files.length) lines.push('_（无源文件或全部被忽略）_');
  return lines.join('\n') + '\n';
}

function renderDirs(title, moduleDir, files, notes) {
  const lines = [
    `# 文件索引 · ${title}`,
    '',
    '> 粒度 dirs：只列目录骨架与有关键职责注记的文件；其余文件不逐行登记。',
    `> 全量清单（不落盘）：\`node <skill>/scripts/sync.mjs . --list ${title}\``,
    '',
  ];
  const dirs = scanDirsWithCounts(moduleDir, title);
  for (const d of dirs) lines.push(`- \`${d.path}/\` — (${d.files} 文件)`);
  const noted = files.filter((f) => noteOf(notes, f.path));
  for (const f of noted) lines.push(`- \`${f.path}\` — (${human(f.size)}) ${noteOf(notes, f.path)}`);
  const unlisted = files.filter((f) => !noteOf(notes, f.path)).length;
  if (unlisted) lines.push(`_（另 ${unlisted} 个文件未登记；需要登记时在行尾写职责，下次 sync 保留）_`);
  if (!files.length && !dirs.length) lines.push('_（无源文件或全部被忽略）_');
  return lines.join('\n') + '\n';
}

function renderModules(title, files) {
  return [
    `# 文件索引 · ${title}`,
    '',
    `> 粒度 modules：模块级治理，不维护文件索引（${files.length} 个文件）。`,
    `> 全量清单（不落盘）：\`node <skill>/scripts/sync.mjs . --list ${title}\``,
    '',
  ].join('\n') + '\n';
}

// ---- --list：把模块全量清单打到 stdout（不写盘）----
if (args.list) {
  const m = args.list;
  const full = path.join(target, m);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) { console.error(`模块不存在: ${m}`); process.exit(2); }
  const files = scanFiles(full, m);
  for (const f of files) console.log(f.path);
  console.error(`（共 ${files.length} 个文件；未写盘，仅本次输出）`);
  process.exit(0);
}

const mapDir = path.join(target, 'docs', 'map');
const treeDir = path.join(mapDir, 'tree');
fs.mkdirSync(treeDir, { recursive: true });
const dirs = governedDirs();

let changed = 0;

// root/ 文档生命周期集合：与 init 的模块集合对齐（目录模块 + 根级配置文件模块）
const safeName = (s) => s.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_');
const rootDocs = new Set(dirs.map(safeName));
{
  let entries; try { entries = fs.readdirSync(target, { withFileTypes: true }); } catch { entries = []; }
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (IGNORE_NAMES.has(ent.name) || ent.name.startsWith('.') || ROOT_DOC.has(ent.name)) continue;
    if (isCfgFile(ent.name)) rootDocs.add(safeName(ent.name));
  }
}

for (const d of dirs) {
  const treeFile = path.join(treeDir, `${d}.md`);
  const notes = loadNotes(treeFile);
  const found = scanFiles(path.join(target, d), d);
  let newContent;
  if (level === 'files') newContent = renderFiles(d, found, notes);
  else if (level === 'dirs') newContent = renderDirs(d, path.join(target, d), found, notes);
  else newContent = renderModules(d, found);
  const oldContent = fs.existsSync(treeFile) ? fs.readFileSync(treeFile, 'utf8') : '';
  if (oldContent !== newContent) {
    fs.writeFileSync(treeFile, newContent, 'utf8'); changed++;
    console.log(`  ↻ ${d}/tree 已刷新（粒度 ${level}，${found.length} 文件）`);
  } else console.log(`  · ${d} 无变化`);
}

// root-files.md：files 级维护全量；dirs/modules 级降为统计 stub（防旧全量清单残留）
if (level === 'files') {
  const rootFiles = [];
  let entries; try { entries = fs.readdirSync(target, { withFileTypes: true }); } catch { entries = []; }
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (IGNORE_NAMES.has(ent.name) || isCfgFile(ent.name) || ent.name.startsWith('.') || ROOT_DOC.has(ent.name)) continue;
    if (BINARY_EXT.has(path.extname(ent.name).toLowerCase())) continue;
    let size = 0; try { size = fs.statSync(path.join(target, ent.name)).size; } catch {}
    rootFiles.push({ path: ent.name, size });
  }
  rootFiles.sort((a, b) => a.path.localeCompare(b.path));
  const treeFile = path.join(treeDir, 'root-files.md');
  const newContent = renderFiles('根级散文件', rootFiles, loadNotes(treeFile));
  const oldContent = fs.existsSync(treeFile) ? fs.readFileSync(treeFile, 'utf8') : '';
  if (oldContent !== newContent) { fs.writeFileSync(treeFile, newContent, 'utf8'); changed++; console.log(`  ↻ root-files 已刷新 (${rootFiles.length} 文件)`); }
  else console.log('  · root-files 无变化');
} else if (fs.existsSync(path.join(treeDir, 'root-files.md'))) {
  const stub = `# 文件索引 · 根级散文件\n\n> 粒度 ${level}：根级散文件不逐行登记（见 docs/map/index.md）。\n`;
  const old = fs.readFileSync(path.join(treeDir, 'root-files.md'), 'utf8');
  if (old !== stub) { fs.writeFileSync(path.join(treeDir, 'root-files.md'), stub, 'utf8'); changed++; console.log('  ↻ root-files 降为 stub（当前粒度不维护全量）'); }
}

// 孤儿清理：保护名 + 当前治理模块集合；其余删除
for (const f of fs.readdirSync(treeDir)) {
  if (!f.endsWith('.md')) continue;
  const name = f.replace(/\.md$/, '');
  if (PROTECTED_TREE.has(name) || dirs.includes(name)) continue;
  fs.unlinkSync(path.join(treeDir, f)); changed++;
  console.log(`  ✂ 孤儿 tree 已清理：${f}（对应模块已不存在/不在白名单）`);
}

// root/ 孤儿清理：删除不属于当前模块集合（目录模块 + 根级配置文件模块）的 root 文档
{
  const rootDir = path.join(mapDir, 'root');
  if (fs.existsSync(rootDir)) {
    for (const f of fs.readdirSync(rootDir)) {
      if (!f.endsWith('.md')) continue;
      const name = f.replace(/\.md$/, '');
      if (rootDocs.has(name)) continue;
      fs.unlinkSync(path.join(rootDir, f)); changed++;
      console.log(`  ✂ 孤儿 root 已清理：${f}（对应模块已不存在/不在白名单）`);
    }
  }
}

// ---- root.md 模块表汇总（单一事实源 = root/<模块>.md；标记区间由 sync 派生，勿手改）----
{
  const rootFile = path.join(mapDir, 'root.md');
  const b = P.TABLE_BEGIN;
  const e = P.TABLE_END;
  if (fs.existsSync(rootFile)) {
    const content = P.readText(rootFile);
    const rows = ['| 模块 | 职责 | 相关模块 | 负责 |', '|---|---|---|---|'];
    for (const d of dirs) {
      const text = P.readText(path.join(mapDir, 'root', `${d}.md`)) || '';
      const fields = P.extractModuleFields(text);
      const rel = P.extractRelatedModules(text, dirs);
      rows.push(`| \`${d}\` | ${fields.duty} | ${rel.size ? [...rel].map((n) => `\`${n}\``).join('、') : '（待填）'} | ${fields.owner} |`);
    }
    const table = rows.join('\n');
    if (content.includes(b) && content.includes(e)) {
      const newContent = content.replace(new RegExp(b + '[\\s\\S]*?' + e), b + '\n' + table + '\n' + e);
      if (newContent !== content) { fs.writeFileSync(rootFile, newContent, 'utf8'); changed++; console.log('  ↻ root.md 模块表已从 root/<模块>.md 汇总'); }
    }
  }
}

// ---- index.md 导航 reconcile（--reindex 刷新；否则提示）----
{
  const indexFile = path.join(mapDir, 'index.md');
  if (fs.existsSync(indexFile)) {
    const txt = P.readText(indexFile);
    const listed = P.extractIndexNav(txt);
    const missing = dirs.filter((d) => !listed.has(d));
    const extra = [...listed].filter((l) => !dirs.includes(l));
    if (missing.length || extra.length) {
      if (args.reindex) {
        const lines = txt.split('\n');
        const navIdx = lines.findIndex((l) => l.startsWith('## 导航'));
        if (navIdx >= 0) {
          const nextHead = lines.findIndex((l, i) => i > navIdx && l.startsWith('## '));
          const before = lines.slice(0, navIdx + 2);
          const after = nextHead >= 0 ? lines.slice(nextHead) : [];
          const navList = dirs.map((d) => `- \`${d}\` — 见 root/${d}.md（职责待填）`);
          const newTxt = before.join('\n') + '\n' + navList.join('\n') + '\n\n' + (after.length ? after.join('\n') : '');
          if (newTxt !== txt) { fs.writeFileSync(indexFile, newTxt, 'utf8'); changed++; console.log('  ↻ index.md 导航已与模块对齐（--reindex）'); }
        }
      } else {
        console.log(`  ℹ️ index.md 模块一览与实际不符${missing.length ? `（缺:${missing.join(',')}）` : ''}${extra.length ? `（多:${extra.join(',')}）` : ''}——用 --reindex 刷新导航`);
      }
    }
  }
}

// ---- --links：跨模块引用候选（共用 lib-links 扫描器，写 .internal/ 不入库）----
if (args.links || config.links) {
  const files = dirs.flatMap((d) => scanFiles(path.join(target, d), d).map((f) => f.path));
  const links = findCrossModuleLinks(files, target);
  const internalDir = path.join(target, '.internal');
  fs.mkdirSync(internalDir, { recursive: true });
  if (links.length) {
    const lines = links.map((l) => `${l.from} → ${l.to} (${l.refs} 处引用)`);
    fs.writeFileSync(path.join(internalDir, 'link-candidates.txt'), lines.join('\n') + '\n', 'utf8');
    console.log(`\n🔗 跨模块引用候选 ${links.length} 条（已写 .internal/link-candidates.txt）：
   确认真实关联 → 填入 root/<模块>.md「相关模块」节；
   判断为噪音 → 登记 docs/map/memo/link-triage.md（check 将不再提示/拦截）：`);
    for (const l of links.slice(0, 30)) console.log(`   ${l.from} → ${l.to} (${l.refs})`);
  } else {
    fs.rmSync(path.join(internalDir, 'link-candidates.txt'), { force: true });
    console.log('\n🔗 未发现跨模块引用候选。');
  }
}

console.log(`\n✅ sync 完成（粒度 ${level}）：${changed} 处更新。治理模块 ${dirs.length} 个：${dirs.join(', ')}`);
console.log('提示：新增/变更功能链路的，记得同步 CHANGELOG.md 的 [Unreleased]。');