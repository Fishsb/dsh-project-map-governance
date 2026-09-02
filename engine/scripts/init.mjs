#!/usr/bin/env node
// project-map-governance · init.mjs（v3，规则引擎版）
// 在项目工作区初始化「项目地图 + 更新日志」治理 v3（规则表 + severity + 自动迁移）：
//   - AGENTS.md(+CLAUDE.md) 收缩版：一句话 + 指针 + 规则（生态兼容：Claude Code 自动读 CLAUDE.md）
//   - docs/map/index.md：llms.txt 式 LLM 导航（H1 + 摘要 + 导航/治理 + Optional）
//   - docs/map/root.md + root/<模块>.md：模块总览 +「相关模块」关联层
//   - docs/map/tree/<模块>.md：按粒度 files|dirs|modules（默认按文件数自动选择）
//   - docs/map/governance.json：治理配置（粒度/白名单/忽略/strict/links）
//   - pre-commit hook（读配置决定 strict，不再硬编码）
// 用法: node init.mjs <项目路径> [--root 模块目录名,逗号分隔] [--level files|dirs|modules] [--links] [--no-hook] [--force] [--hook-only]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as P from './lib-parse.mjs';

// skill 自身目录（<skill>/scripts/init.mjs → <skill>）；hook 与文档引用一律动态派生
const SKILL_DIR = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const SKILL_POSIX = SKILL_DIR.replace(/\\/g, '/');

// ---- 治理边界（与 sync/check 同代配套）----
const IGNORE_NAMES = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__', '.venv', 'venv', '.cache', '.next', 'target', '.DS_Store', 'docs', '.internal', 'assets']);
const IGNORE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.map', '.tar', '.gz', '.zip', '.lock', '.exe', '.dll', '.bin']);
const PROTECTED_TREE = new Set(['index', 'files', 'root-files']);
// 根级通用文档/隐藏元数据：不入 tree（与 sync ROOT_DOC 对称）
const ROOT_DOC = new Set(['AGENTS.md', 'CLAUDE.md', 'CHANGELOG.md', 'README.md', 'README.en.md', 'LICENSE', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', '.gitignore', '.gitattributes', '.gitmodules', '.editorconfig']);
// 档位阈值：文件数 < AUTO_FILES → files 级；< AUTO_DIRS → dirs 级；否则 modules 级
const AUTO_FILES = 500;
const AUTO_DIRS = 2000;
const LEVELS = new Set(['files', 'dirs', 'modules']);

function usage() {
  console.error('用法: node init.mjs <项目路径> [--root 模块目录名,逗号分隔] [--level files|dirs|modules] [--links] [--strict-links] [--changelog] [--strict-semantics] [--no-hook] [--force] [--hook-only]');
  process.exit(2);
}

function parseArgs(argv) {
  const args = { rootDirs: null, level: null, links: false, strictLinks: false, changelog: false, strictSemantics: false, noHook: false, force: false, hookOnly: false, target: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-hook') args.noHook = true;
    else if (a === '--force') args.force = true;
    else if (a === '--hook-only') args.hookOnly = true;
    else if (a === '--links') args.links = true;
    else if (a === '--strict-links') { args.links = true; args.strictLinks = true; }
    else if (a === '--changelog') args.changelog = true;
    else if (a === '--strict-semantics') args.strictSemantics = true;
    else if (a === '--level') args.level = argv[++i] || '';
    else if (a === '--root') args.rootDirs = argv[++i]?.split(',').map((s) => s.trim()).filter(Boolean) || [];
    else if (a.startsWith('--')) { console.error(`未知参数: ${a}`); usage(); }
    else if (!args.target) args.target = a;
    else usage();
  }
  if (args.level && !LEVELS.has(args.level)) { console.error(`未知粒度: ${args.level}（可选 files|dirs|modules）`); usage(); }
  return args;
}

const isCfgFile = (name) => /^\.?[a-zA-Z0-9_\-]+\.(json|ya?ml|toml|ini|cfg|lock)$/.test(name);
const human = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
const safeName = (s) => s.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_');

function scanDir(root, prefix = '') {
  // 返回 { dirs:[{path, files}], files:[{path,size}] }（与 sync 同语义：点目录/配置/二进制不入图）
  const dirs = [];
  const files = [];
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return { dirs, files }; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const ent of entries) {
    if (IGNORE_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
    const full = path.join(root, ent.name);
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      const sub = scanDir(full, rel);
      dirs.push({ path: rel, files: sub.files.length + sub.dirs.reduce((s, d) => s + d.files, 0) });
      dirs.push(...sub.dirs);
      files.push(...sub.files);
      continue;
    }
    if (isCfgFile(ent.name) || IGNORE_EXT.has(path.extname(ent.name).toLowerCase())) continue;
    let size = 0; try { size = fs.statSync(full).size; } catch {}
    files.push({ path: rel, size });
  }
  return { dirs, files };
}

function moduleHeads(target, explicit) {
  const heads = [];
  if (explicit && explicit.length) return explicit;
  let entries;
  try { entries = fs.readdirSync(target, { withFileTypes: true }); } catch { return heads; }
  for (const ent of entries) {
    if (IGNORE_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
    if (ent.isDirectory()) heads.push(ent.name);
    else if (isCfgFile(ent.name)) heads.push(ent.name); // 根级配置文件也算"模块"（root 视图书）
  }
  return heads.sort((a, b) => a.localeCompare(b));
}

function autoLevel(totalFiles) {
  if (totalFiles < AUTO_FILES) return 'files';
  if (totalFiles < AUTO_DIRS) return 'dirs';
  return 'modules';
}

function loadExistingNotes(treeFile) {
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

// ---- tree 渲染（按粒度）----
function renderTreeFiles(title, files, notes) {
  const lines = [`# 文件索引 · ${title}`, '', '> 由 sync.mjs 自动同步（职责为人工维护）。粒度 files：全量文件登记。', ''];
  for (const f of files) {
    const note = noteOf(notes, f.path) || '(职责待填)';
    lines.push(`- \`${f.path}\` — (${human(f.size)}) ${note}`);
  }
  if (!files.length) lines.push('_（无源文件或全部被忽略）_');
  return lines.join('\n') + '\n';
}

function renderTreeDirs(title, scan, notes) {
  // 粒度 dirs：目录骨架 + 有职责注记的关键文件；未列文件只给统计。
  const lines = [
    `# 文件索引 · ${title}`,
    '',
    '> 粒度 dirs：只列目录骨架与有关键职责注记的文件；未登记文件不逐行列出。',
    '> 全景（不落盘）：`node <skill>/scripts/sync.mjs . --list ' + title + '`',
    '',
  ];
  const dirRows = scan.dirs.sort((a, b) => a.path.localeCompare(b.path)).map((d) => `- \`${d.path}/\` — (${d.files} 文件)`);
  lines.push(...dirRows);
  const noted = scan.files.filter((f) => noteOf(notes, f.path));
  for (const f of noted) lines.push(`- \`${f.path}\` — (${human(f.size)}) ${noteOf(notes, f.path)}`);
  const unlisted = scan.files.filter((f) => !noteOf(notes, f.path)).length;
  if (unlisted) lines.push(`_（另 ${unlisted} 个文件未登记；为它们写职责后 sync 会保留）_`);
  if (!scan.files.length && !scan.dirs.length) lines.push('_（无源文件或全部被忽略）_');
  return lines.join('\n') + '\n';
}

function renderTreeModules(title, scan) {
  return [
    `# 文件索引 · ${title}`,
    '',
    `> 粒度 modules：模块级治理，不维护文件索引（${scan.files.length} 个文件）。`,
    `> 全景（不落盘）：\`node <skill>/scripts/sync.mjs . --list ${title}\``,
    '',
  ].join('\n') + '\n';
}

// ---- 文档生成 ----
function build(meta) {
  const { target, name, heads, level } = meta;
  const rel = (p) => path.relative(target, p).replace(/\\/g, '/');

  // 1) AGENTS.md + CLAUDE.md（收缩版：一句话 + 指针 + 规则；两文件同内容保证 Claude Code 生态可用）
  const agentsText = [
    `# AGENTS.md — ${name} 协同治理入口`,
    '',
    `> ${name}：<一句话项目描述，待填>`,
    '',
    '## 开工前必读',
    `- **项目地图** → \`docs/map/index.md\`（LLM 友好导航：先读摘要，再按指针下钻，禁止全项目扫描）`,
    '- 更新日志 → `CHANGELOG.md` 的 [Unreleased]',
    '',
    '## 规则',
    '1. **改前影响分析**：先读目标模块 `docs/map/root/<模块>.md`，特别是「相关模块」节——跨模块关联（功能逻辑 ↔ 展示层等）是本项目漂移高发区。',
    `2. **改后同步**：新增/删除/移动文件 → \`node "${SKILL_POSIX}/scripts/sync.mjs" .\`；用户可感知改动 → 写 CHANGELOG。`,
    '3. **提交前**：pre-commit 自动 `check` 地图；漂移会拦截 commit（提示先 sync）。',
    '4. **决策与变更记录**：重大架构/技术决策 → 记 ADR（`node <skill>/scripts/adr.mjs . "<标题>"`）；用户可感知改动 → CHANGELOG.md [Unreleased]。',
    '',
    `_初始化于 ${new Date().toISOString().slice(0, 10)} — 由 project-map-governance/init.mjs v3 生成。skill 见 ${SKILL_POSIX}/SKILL.md_`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(target, 'AGENTS.md'), agentsText, 'utf8');
  const claudePath = path.join(target, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) fs.writeFileSync(claudePath, agentsText, 'utf8'); // Claude Code 自动读

  // 2) docs/map/
  const mapDir = path.join(target, 'docs', 'map');
  fs.mkdirSync(path.join(mapDir, 'root'), { recursive: true });
  fs.mkdirSync(path.join(mapDir, 'tree'), { recursive: true });
  const levelLabel = level === 'files' ? '文件级（全量）' : level === 'dirs' ? '目录骨架+关键文件' : '模块级';

  // index.md：llms.txt 式（H1 + 摘要 blockquote + 导航/治理 + Optional）
  const indexLines = [
    `# 项目地图 · ${name}`,
    '',
    `> ${name}：<一句话项目摘要，待填>。本文件是 LLM 友好导航（llms.txt 式）：先读这一句 + 导航，细节按链接按需取。`,
    '',
    '## 导航',
    '',
  ];
  for (const h of heads) indexLines.push(`- \`${h}\` — 见 root/${safeName(h)}.md（职责待填）`);
  indexLines.push('', '## 治理', '');
  indexLines.push(`- [模块总览（含关联总图）](root.md)`);
  if (level === 'files') indexLines.push(`- [文件级地图](tree/)（粒度：${levelLabel}）`);
  else indexLines.push(`- [文件索引](tree/)（粒度：${levelLabel}；全量清单运行时 \`sync --list\` 查看）`);
  indexLines.push('- [工程约定](conventions.md) — 按需创建（技术栈/命令/模式）');
  indexLines.push('- [架构决策](decisions/README.md) — ADR 记录（新增：`node <skill>/scripts/adr.mjs . "<标题>"`）');
  indexLines.push('- [更新日志](../CHANGELOG.md)');
  indexLines.push('', '## Optional', '');
  indexLines.push('- memo/ — 按需深挖的细节文档（关键符号/决策/坑）');
  indexLines.push('- devref/ — 本地开发参考（gitignore 排除，不推 GitHub）');
  indexLines.push('- 全量文件清单：不落盘；`node <skill>/scripts/sync.mjs . --list <模块>` 按需查看');
  fs.writeFileSync(path.join(mapDir, 'index.md'), indexLines.join('\n') + '\n', 'utf8');

  // root.md：模块总览（模块表由 sync 从 root/<模块>.md 自动汇总，标记区间请勿手改）
  const rootLines = [
    `# 模块总览 · ${name}`,
    '',
    '> 模块级职责/影响面。**相关模块 = 跨模块影响面**：改一个模块前必须检查其相关模块。',
    '> 本表由 sync 从 root/<模块>.md 自动汇总（【模块表】标记之间请勿手改）；候选可由 `sync --links` 探测。',
    '',
    '<!-- MODULE_TABLE_BEGIN -->',
    '| 模块 | 职责 | 相关模块 | 负责 |',
    '|---|---|---|---|',
    '<!-- MODULE_TABLE_END -->',
    '',
  ];
  fs.writeFileSync(path.join(mapDir, 'root.md'), rootLines.join('\n'), 'utf8');

  // root/<模块>.md：职责/影响 + 相关模块（关联层）
  for (const h of heads) {
    const full = path.join(target, h);
    const isDir = fs.existsSync(full) && fs.statSync(full).isDirectory();
    const lines = [
      `# 模块 · ${h}`,
      '',
      `> 一级模块：${isDir ? '目录' : '配置文件'}。职责/影响需人工/agent 补充。`,
      '',
      `- **路径**：\`${h}\``,
      `- **类型**：${isDir ? '目录' : '文件'}`,
      '- **职责**：（待填）',
      '- **负责**：（待填）',
      '- **改动影响**：（待填，涉及哪些链路）',
      '',
      '## 相关模块',
      '<!-- 跨模块影响面：改本模块必须同步检查的模块。方向：本模块影响它 / 本模块依赖它 / 双向。由 sync --links 给候选，人工确认后填。 -->',
      '- （待填）`<模块或文件路径>` — 与<本模块>的关系',
      '',
      ...(isDir ? [`> 文件级细节见 ../tree/${safeName(h)}.md。`, ''] : []),
    ];
    fs.writeFileSync(path.join(mapDir, 'root', `${safeName(h)}.md`), lines.join('\n'), 'utf8');

    // tree/<模块>.md：按粒度
    if (isDir) {
      const scanned = scanDir(full, h);
      const notes = loadExistingNotes(path.join(mapDir, 'tree', `${safeName(h)}.md`));
      let content;
      if (level === 'files') content = renderTreeFiles(h, scanned.files, notes);
      else if (level === 'dirs') content = renderTreeDirs(h, scanned, notes);
      else content = renderTreeModules(h, scanned);
      fs.writeFileSync(path.join(mapDir, 'tree', `${safeName(h)}.md`), content, 'utf8');
    }
  }

  // decisions/：ADR 捕获骨架（单一事实源 = ADR-NNNN.md；new 用 adr.mjs）
  fs.mkdirSync(path.join(mapDir, 'decisions'), { recursive: true });
  fs.writeFileSync(path.join(mapDir, 'decisions', 'README.md'), [
    '# 架构决策记录（ADR）',
    '',
    '> 记录「为什么这样设计」的重大决策，供未来 agent / 人复用，避免重复决策或踩旧坑。',
    '> 新增一条：`node <skill>/scripts/adr.mjs . "<决策标题>"`（自动编号 ADR-XXXX.md）。',
    '',
    '| ADR | 标题 | 状态 | 日期 |',
    '|---|---|---|---|',
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(mapDir, 'decisions', '_template.md'), [
    '# ADR-0000：<标题>',
    '',
    '> 状态：proposed ｜ accepted ｜ deprecated ｜ superseded',
    '',
    '## 背景',
    '',
    '（为什么需要这个决策）',
    '',
    '## 决策',
    '',
    '（我们决定怎么做）',
    '',
    '## 后果',
    '',
    '（正面收益与副作用 / 成本）',
    '',
    '## 替代方案',
    '',
    '（考虑过但未选的方案及原因）',
    '',
    '## 日期',
    '',
  ].join('\n'), 'utf8');

  // root-files.md（仅 files 级登记根级散文件；dirs/modules 级由 sync 按需维护）
  if (level === 'files') {
    const rootFiles = [];
    let entries; try { entries = fs.readdirSync(target, { withFileTypes: true }); } catch { entries = []; }
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (IGNORE_NAMES.has(ent.name) || isCfgFile(ent.name)) continue;
      if (ent.name.startsWith('.')) continue;
      if (ROOT_DOC.has(ent.name)) continue;
      if (IGNORE_EXT.has(path.extname(ent.name).toLowerCase())) continue;
      let size = 0; try { size = fs.statSync(path.join(target, ent.name)).size; } catch {}
      rootFiles.push({ path: ent.name, size });
    }
    rootFiles.sort((a, b) => a.path.localeCompare(b.path));
    // 常写（空列表也落占位），保证与 sync 幂等
    fs.writeFileSync(path.join(mapDir, 'tree', 'root-files.md'), renderTreeFiles('根级散文件', rootFiles, new Map()), 'utf8');
  }

  // 3.5) 清理孤儿（root/* 与 tree/* 中已不属于当前模块集合的生成文件）
  const keepRoot = new Set(heads.map((h) => `${safeName(h)}.md`));
  const keepTree = new Set([...heads.map((h) => `${safeName(h)}.md`), ...[...PROTECTED_TREE].map((n) => `${n}.md`)]);
  const pruneDir = (dir, keep) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.md') && !keep.has(f)) {
        fs.unlinkSync(path.join(dir, f));
        console.log(`  ✂ 孤儿已清理：${path.relative(mapDir, path.join(dir, f))}`);
      }
    }
  };
  pruneDir(path.join(mapDir, 'root'), keepRoot);
  pruneDir(path.join(mapDir, 'tree'), keepTree);

  // 4) governance.json（v3：规则表 + severity + 自动迁移支持）
  const config = {
    configVersion: P.CONFIG_VERSION,
    generatedBy: 'project-map-governance/init.mjs v3',
    level,
    autoLevel: { files: AUTO_FILES, dirs: AUTO_DIRS },
    rules: P.defaultRules(),
  };
  if (meta.rootDirs && meta.rootDirs.length) config.roots = meta.rootDirs;
  if (meta.links) {
    config.links = true;
    config.rules.relatedness = meta.strictLinks ? 'error' : 'warn';
  }
  if (meta.changelog) config.rules.changelog = 'error';
  if (meta.strictSemantics) config.rules.semantics = 'error';
  P.saveConfig(target, config);

  // 5) .gitignore：.internal/（检查器/链接候选等瞬态数据不入库）
  {
    const gi = path.join(target, '.gitignore');
    const block = '\n# ---- project-map-governance（瞬态数据，不入库）----\n.internal/\n';
    if (fs.existsSync(gi)) { if (!fs.readFileSync(gi, 'utf8').includes('.internal/')) fs.appendFileSync(gi, block, 'utf8'); }
    else fs.writeFileSync(gi, '# gitignore\n' + block, 'utf8');
  }

  // 6) CHANGELOG.md（存在则保留）
  const chgPath = path.join(target, 'CHANGELOG.md');
  if (fs.existsSync(chgPath)) {
    console.log(`⚠️ CHANGELOG.md 已存在，保留未动：${rel(chgPath)}`);
  } else {
    fs.writeFileSync(chgPath, [
      '# Changelog', '',
      `> ${name} 更新日志。基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。`, '',
      '## [Unreleased]', '',
      '### Added', '- 无', '',
    ].join('\n'), 'utf8');
  }

  return { agentsOld: path.join(target, 'AGENTS.md'), mapDir };
}

// ---- node 定位 / hook 安装（同 v1，hook 不再硬编码 --strict，由 check 读配置）----
function detectNode() {
  const candidates = [
    process.execPath,
    process.env.DSH_NODE,
    'C:\\Users\\lk\\hermes\\0.20.0\\win-x64\\node\\node.exe',
    'C:\\Program Files\\nodejs\\node.exe',
    'D:\\lk\\hermes\\0.20.0\\win-x64\\node\\node.exe',
  ];
  for (const c of candidates) { if (c && fs.existsSync(c)) return c; }
  try {
    const which = spawnSync('where', ['node'], { shell: false });
    if (which.status === 0) {
      const p = which.stdout.toString().split(/\r?\n/)[0].trim();
      if (p.endsWith('.exe')) return p;
      return 'node';
    }
  } catch {}
  return 'node';
}

function installHook(target, noHook) {
  const gitDir = path.join(target, '.git');
  if (!fs.existsSync(gitDir)) { console.log('⚠️ 非 git 仓库，跳过 pre-commit hook 安装。'); return false; }
  if (noHook) { console.log('--no-hook，跳过 pre-commit 安装。'); return false; }
  const hooksDir = path.join(gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const hookFile = path.join(hooksDir, 'pre-commit');
  const node = detectNode();
  const content = `#!/bin/sh
# generated by project-map-governance/init.mjs v3
# commit 前检查项目地图是否漂移（strict 与否由 docs/map/governance.json 决定）。
NODE="${node}"
SKILL="${SKILL_DIR}"
PROJ="${target.replace(/\\/g, '/')}"
if [ ! -x "$NODE" ] && [ -z "$(command -v node)" ]; then
  echo "[project-map-governance] ⚠️ 找不到 node，跳过地图检查。" >&2
  exit 0
fi
if [ -x "$NODE" ]; then NODE_BIN="$NODE"; else NODE_BIN="node"; fi
cd "$PROJ" || exit 0
"$NODE_BIN" "$SKILL/scripts/check.mjs" "$PROJ" >&2
status=$?
if [ $status -eq 1 ]; then
  echo "[project-map-governance] ⛔ 项目地图漂移：先运行 node \"$SKILL/scripts/sync.mjs\" \"$PROJ\" 再提交。可用 --no-verify 跳过。" >&2
  exit 1
fi
exit 0
`;
  fs.writeFileSync(hookFile, content, { encoding: 'utf8' });
  console.log('✅ pre-commit hook 已安装：', hookFile, '(node:', node, ')');
  return true;
}

// ---- main ----
const args = parseArgs(process.argv.slice(2));
if (!args.target) usage();
const target = path.resolve(args.target);
if (!fs.existsSync(target)) { console.error(`项目路径不存在: ${target}`); process.exit(1); }

const name = path.basename(target);
const heads = moduleHeads(target, args.rootDirs);
const meta = { target, name, heads, rootDirs: args.rootDirs, links: args.links, strictLinks: args.strictLinks, changelog: args.changelog, strictSemantics: args.strictSemantics };

const existingAgents = fs.existsSync(path.join(target, 'AGENTS.md'));
const existingMap = fs.existsSync(path.join(target, 'docs', 'map'));

if (args.hookOnly) {
  console.log(`--hook-only：仅安装 pre-commit hook，不改动任何地图文件 → ${target}`);
  installHook(target, args.noHook);
  console.log('✅ 完成（hook only）。');
  process.exit(0);
}

if ((existingAgents || existingMap) && !args.force) {
  console.log('⚠️ 检测到已存在的治理文件（AGENTS.md / docs/map）：保留现有精装地图，仅安装/更新 pre-commit hook。');
  console.log('（如需整套重建覆盖，加 --force）');
  installHook(target, args.noHook);
  process.exit(0);
}

// 粒度：显式 --level > 自动（按治理范围内文件数）
let totalFiles = 0;
for (const h of heads) {
  const full = path.join(target, h);
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) totalFiles += scanDir(full, h).files.length;
}
const level = args.level || autoLevel(totalFiles);
meta.level = level;

const levelNote = args.level
  ? '（显式）'
  : `（自动：${totalFiles} 文件，${level === 'files' ? '< ' + AUTO_FILES : level === 'dirs' ? '< ' + AUTO_DIRS : '≥ ' + AUTO_DIRS}）`;
console.log(`初始化治理 v3 → ${target}（粒度: ${level}${levelNote}）`);
console.log(`识别模块 ${heads.length} 个: ${heads.join(', ')}`);

const result = build(meta);
installHook(target, args.noHook);
console.log('✅ 完成。生成：');
console.log(`  ${path.relative(target, result.agentsOld)} (+CLAUDE.md)`);
console.log(`  ${path.relative(target, path.join('docs/map'))}/（index·root·tree·governance.json）`);
console.log('');
console.log('下一步：');
console.log('  1. 打开 AGENTS.md / docs/map/index.md 补充「一句话描述」与 root/* 的职责/相关模块');
console.log('  2. 若有关键跨模块关联，跑 `sync --links` 生成候选并确认填入 root/<模块>.md');
console.log('  3. 日常改完代码 → 跑 sync 更新 tree；随时 → 跑 check 验证（漂移/规模/关联提示）');