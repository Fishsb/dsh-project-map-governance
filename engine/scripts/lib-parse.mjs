#!/usr/bin/env node
// project-map-governance · lib-parse.mjs（统一解析层，v3）
// 所有治理文档格式与配置的"单一解析源"：init/sync/check/adr/reconcile/插件/MCP 共用。
// 格式规格：
//   - module 字段：root/<模块>.md 内 `- **职责/负责/改动影响**：VALUE`
//   - 相关模块：`## 相关模块` 节（到下一个 `## ` 或文件尾），含模块名/路径 `X`（`<!--` 注释与（待填）忽略）
//   - root.md 派生表：`<!-- MODULE_TABLE_BEGIN -->` … `<!-- MODULE_TABLE_END -->`
//   - index 导航：`## 导航` 节内 `- \`模块\` — 见 root/…`
//   - CHANGELOG [Unreleased]：`## [Unreleased]` 到下一个 `## `
//   - link-triage：每行 `A → B`（`#`/`<!--` 注释忽略）
//   - hygiene 豁免：文件头 1024 字符内含 `<!-- hygiene: ignore -->`
//   - 配置：docs/map/governance.json（v3：rules 表 + severity）
import fs from 'node:fs';
import path from 'node:path';

export const TABLE_BEGIN = '<!-- MODULE_TABLE_BEGIN -->';
export const TABLE_END = '<!-- MODULE_TABLE_END -->';
export const CONFIG_VERSION = 3;
export const RULE_IDS = ['dead-links', 'untracked-strict', 'relatedness', 'changelog', 'semantics', 'size', 'root-consistency', 'index-consistency', 'index-format', 'doc-hygiene'];
export const SEVERITIES = ['off', 'warn', 'error'];

// ---- 治理边界（单一源：check/sync/init 共用，勿在各脚本重复定义）----
// 取三脚本语义并集：跨平台点目录/构建产物/docs 治理层/瞬态数据一律不入图
export const IGNORE_NAMES = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__', '.venv', 'venv', '.cache', '.next', 'target', 'docs', '.internal', 'assets', '.DS_Store']);
export const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.map', '.tar', '.gz', '.zip', '.lock', '.exe', '.dll', '.bin']);
export const ROOT_DOC = new Set(['AGENTS.md', 'CLAUDE.md', 'CHANGELOG.md', 'README.md', 'README.en.md', 'LICENSE', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', '.gitignore', '.gitattributes', '.gitmodules', '.editorconfig']);
export const isCfgFile = (n) => /^\.?[a-zA-Z0-9_\-]+\.(json|ya?ml|toml|ini|cfg|lock)$/.test(n);
export const isBinary = (p) => BINARY_EXT.has(path.extname(p).toLowerCase());
export const safeName = (s) => s.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_');

/**
 * 治理 root 文档集合 = 目录模块（dirs）+ 根级配置文件模块（package.json 等）的 safeName。
 * 与 init 的模块集合对齐：init 把根级配置文件也算模块（生成 root/*.md），
 * sync/check 需守护这些文档（语义/死链），避免"三无孤儿"。
 */
export function governedRootDocs(target, dirs) {
  const set = new Set(dirs.map(safeName));
  let entries; try { entries = fs.readdirSync(target, { withFileTypes: true }); } catch { entries = []; }
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (IGNORE_NAMES.has(ent.name) || ent.name.startsWith('.') || ROOT_DOC.has(ent.name)) continue;
    if (isCfgFile(ent.name)) set.add(safeName(ent.name));
  }
  return set;
}

export function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

// ---- 配置（v3：rules 表；legacy 字段自动迁移）----
export function defaultRules() {
  return {
    'dead-links': 'error',
    'untracked-strict': 'off',
    'relatedness': 'off',
    'changelog': 'off',
    'semantics': 'warn',
    'size': 'warn',
    'root-consistency': 'warn',
    'index-consistency': 'warn',
    'index-format': 'warn',
    'doc-hygiene': 'warn',
  };
}

export function migrateConfig(raw) {
  // legacy（v1/v2.x）字段 → v3 rules 表；返回 { config, migrated }
  if (!raw || typeof raw !== 'object') raw = {};
  let migrated = false;
  const rules = { ...defaultRules(), ...(raw.rules || {}) };
  const hasLegacy = ['strict', 'strictLinks', 'changelog', 'strictSemantics'].some((k) => k in raw);
  if (hasLegacy || raw.configVersion !== CONFIG_VERSION) {
    migrated = true;
    if (raw.strict === true) rules['untracked-strict'] = 'error';
    if (raw.links === true || raw.strictLinks === true) rules['relatedness'] = raw.strictLinks === true ? 'error' : 'warn';
    if (raw.changelog === 'required') rules['changelog'] = 'error';
    else if (raw.changelog === 'hint') rules['changelog'] = 'warn';
    if (raw.strictSemantics === true) rules['semantics'] = 'error';
  }
  const config = { configVersion: CONFIG_VERSION, ...raw, rules };
  delete config.strict; delete config.strictLinks; delete config.strictSemantics; delete config.changelog;
  if (!config.hints) config.hints = {};
  if (!config.autoLevel) config.autoLevel = {};
  return { config, migrated };
}

export function loadConfig(target) {
  const raw = JSON.parse(readText(path.join(target, 'docs', 'map', 'governance.json')) || '{}');
  const { config, migrated } = migrateConfig(raw);
  if (migrated) saveConfig(target, config);
  return config;
}

export function saveConfig(target, config) {
  const file = path.join(target, 'docs', 'map', 'governance.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export function validateConfig(config) {
  const problems = [];
  if (config.configVersion !== CONFIG_VERSION) problems.push(`configVersion 应为 ${CONFIG_VERSION}`);
  if (config.level && !['files', 'dirs', 'modules'].includes(config.level)) problems.push(`level 非法: ${config.level}`);
  for (const [id, sev] of Object.entries(config.rules || {})) {
    if (!SEVERITIES.includes(sev) && !['error', 'warn', 'off'].includes(sev)) problems.push(`rules.${id} 严重度非法: ${sev}`);
  }
  return problems;
}

// ---- root/<模块>.md ----
export function extractField(text, key) {
  for (const line of (text || '').split('\n')) {
    if (line.includes(key)) {
      const v = line.split(/[:：]/).slice(1).join(':').trim();
      return v || '（待填）';
    }
  }
  return '（待填）';
}

export function extractModuleFields(text) {
  return {
    duty: extractField(text, '**职责**'),
    owner: extractField(text, '**负责**'),
    impact: extractField(text, '**改动影响**'),
  };
}

// 相关模块节：返回引用的模块名集合（knownDirs 为空时返回所有反引号路径首段）
export function extractRelatedModules(text, knownDirs = null) {
  const set = new Set();
  const lines = (text || '').split('\n');
  const sec = lines.findIndex((l) => l.startsWith('## 相关模块'));
  if (sec < 0) return set;
  for (let i = sec + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
    const l = lines[i];
    if (l.includes('<!--') || l.includes('待填')) continue;
    const m = l.match(/`([^`]+)`/);
    if (m) {
      const seg = m[1].split(/[/\\]/)[0];
      if (seg && (!knownDirs || knownDirs.includes(seg))) set.add(seg);
    }
  }
  return set;
}

// ---- root.md 派生表 ----
// v3.1：表 = 模块|职责|相关模块（运行时三要素；"负责"为维护信息，下沉 root/<模块>.md 不进派生表，v11 运行时/维护分离）
export function parseRootTable(content) {
  const b = content.indexOf(TABLE_BEGIN);
  const e = content.indexOf(TABLE_END);
  if (b < 0 || e < 0) return null;
  const table = content.slice(b, e);
  const rows = new Map();
  for (const line of table.split('\n')) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|([^|]*)\|([^|]*)\|/);
    if (m) rows.set(m[1], { duty: m[2].trim(), related: m[3].trim() });
  }
  return { table, rows };
}

// ---- index.md 导航 ----
// 导航行格式：`- \`模块\` — 见 root/<模块>.md（<概况：名词短语 ≤30 字，覆盖模块职责要点>）`
// v3.1：概况规范化（吸收 managing-memory v9/v10 概况规则——内容范围路由，防只概括开头误导）
export function extractIndexNav(content) {
  return new Set([...(content || '').matchAll(/^- `([^`]+)` — 见 root\//gm)].map((m) => m[1]));
}
export function extractIndexNavSummaries(content) {
  const map = new Map();
  // 概况 = 行内最后一个（…）括号组（容忍概况内嵌套括号）；无括号视为待填
  for (const m of (content || '').matchAll(/^- `([^`]+)` — 见 root\/[^\n]+/gm)) {
    const line = m[0];
    const mod = m[1];
    const open = line.lastIndexOf('（');
    const close = line.lastIndexOf('）');
    if (open >= 0 && close > open) {
      map.set(mod, line.slice(open + 1, close).trim());
    } else {
      map.set(mod, '');
    }
  }
  return map;
}

// ---- CHANGELOG [Unreleased] ----
export function extractUnreleased(text) {
  const lines = (text || '').split('\n');
  const start = lines.findIndex((l) => l.startsWith('## [Unreleased]'));
  if (start < 0) return '';
  const out = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) out.push(lines[i]);
  return out.join('\n');
}

// ---- link-triage ----
export function extractTriage(text) {
  const set = new Set();
  for (const line of (text || '').split('\n')) {
    if (line.startsWith('#') || line.includes('<!--')) continue;
    const m = line.match(/([\w\-@.]+)\s*→\s*([\w\-@.]+)/);
    if (m) set.add(`${m[1]} → ${m[2]}`);
  }
  return set;
}

// ---- 治理文档本地引用收集（dead-links 扩展：扫 root/index/decisions 内相对文件引用）----
// 从 md 文本收集"指向真实文件"的相对引用，返回相对 rootDir 的 posix 路径。
// 收集两类：
//   1) markdown 导航链接 ](相对路径)
//   2) 反引号内以 ../ 开头的相对文件引用（root 文档"文件级细节见 ../tree/x.md"固定格式）
// 豁免：http(s) 外链、锚点/裸目录/命令（含空格、<skill>、node）、占位 conventions.md、相关模块节内模块路径反引号（非 ../ 开头）。
const MD_LINK_RE = /\]\(([^)]+)\)/g;
const REL_BK_RE = /`(\.\.\/[^`\n]+)`/g;
export function collectLocalFileRefs(text, docDir, rootDir) {
  const out = new Set();
  const candidates = [];
  for (const m of text.matchAll(MD_LINK_RE)) candidates.push(m[1]);
  for (const m of text.matchAll(REL_BK_RE)) candidates.push(m[1]);
  for (let raw of candidates) {
    raw = raw.trim();
    if (!raw || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('#')) continue;
    if (raw.includes(' ') || raw.startsWith('<') || raw.includes('*')) continue;
    const frag = raw.indexOf('#'); if (frag >= 0) raw = raw.slice(0, frag);
    if (raw.endsWith('/')) continue;
    const abs = path.resolve(docDir, raw);
    const rel = path.relative(rootDir, abs).replace(/\\/g, '/');
    if (rel.startsWith('..')) continue; // 仓库外
    if (raw.includes('conventions')) continue; // "按需创建"占位
    out.add(rel);
  }
  return out;
}

// ---- hygiene ----
export function hygieneIgnored(text) {
  return (text || '').slice(0, 1024).includes('<!-- hygiene: ignore -->');
}

export const HYGIENE_SCAR = /(corrected|reversed|earlier draft|TODO|⚠|过时|已废弃|临时方案|此句已不适用)/i;