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
export function parseRootTable(content) {
  const b = content.indexOf(TABLE_BEGIN);
  const e = content.indexOf(TABLE_END);
  if (b < 0 || e < 0) return null;
  const table = content.slice(b, e);
  const rows = new Map();
  for (const line of table.split('\n')) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (m) rows.set(m[1], { duty: m[2].trim(), related: m[3].trim(), owner: m[4].trim() });
  }
  return { table, rows };
}

// ---- index.md 导航 ----
export function extractIndexNav(content) {
  return new Set([...(content || '').matchAll(/^- `([^`]+)` — 见 root\//gm)].map((m) => m[1]));
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

// ---- hygiene ----
export function hygieneIgnored(text) {
  return (text || '').slice(0, 1024).includes('<!-- hygiene: ignore -->');
}

export const HYGIENE_SCAR = /(corrected|reversed|earlier draft|TODO|⚠|过时|已废弃|临时方案|此句已不适用)/i;