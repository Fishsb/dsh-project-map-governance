#!/usr/bin/env node
// project-map-governance · reconcile.mjs（v3）
// 文档卫生 reconcile 工作流（借鉴 document-hygiene "patching ≠ reconciling"）：
//   生成"需要 reconcile 的文档清单 + 核对要点"，供 agent/人执行一次全文档重读。
// 判定依据：
//   1) 距离上次 reconcile 有 git 提交改动过的治理文档（.internal/reconcile-last.txt 记录时间戳）
//   2) 含文档疤痕标记（lib-parse.HYGIENE_SCAR）的治理文档
//   3) 超过 N 天未 reconcile（--days，默认 30）
// 用法: node reconcile.mjs <项目路径> [--days 30] [--json]
import fs from 'node:fs';
import path from 'node:path';
import * as P from './lib-parse.mjs';
import { spawnSync } from 'node:child_process';

function usage() { console.error('用法: node reconcile.mjs <项目路径> [--days 30] [--json]'); process.exit(2); }

let targetArg = null, days = 30, jsonMode = false;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--days') days = parseInt(process.argv[++i] || '30', 10) || 30;
  else if (a === '--json') jsonMode = true;
  else if (!a.startsWith('--')) targetArg = a;
}
if (!targetArg) usage();
const target = path.resolve(targetArg);
if (!fs.existsSync(target)) usage();
const mapDir = path.join(target, 'docs', 'map');
if (!fs.existsSync(mapDir)) { console.error('未找到 docs/map —— 先用 init.mjs 初始化治理。'); process.exit(1); }

const stateFile = path.join(target, '.internal', 'reconcile-last.txt');
let lastStamp = 0;
try { lastStamp = parseInt(fs.readFileSync(stateFile, 'utf8').trim(), 10) || 0; } catch {}

// 1) 自上次 reconcile 后被 git 改动过的治理文档
const changedSince = new Set();
if (fs.existsSync(path.join(target, '.git')) && lastStamp) {
  const r = spawnSync('git', ['log', `--since=${new Date(lastStamp).toISOString()}`, '--name-only', '--pretty=', '--', 'docs/map'], { cwd: target, encoding: 'utf8', timeout: 15000 });
  if (r.status === 0) {
    for (const line of r.stdout.split('\n')) {
      const f = line.trim();
      if (f.endsWith('.md') && f.startsWith('docs/map/')) changedSince.add(f);
    }
  }
}

// 2) 疤痕扫描（跳过 tree/ 与豁免标记）
const scarred = [];
const walk = (d) => {
  let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    if (ent.name === 'tree') continue;
    if (ent.isDirectory()) { walk(path.join(d, ent.name)); continue; }
    if (!ent.name.endsWith('.md')) continue;
    const rel = path.relative(target, path.join(d, ent.name)).replace(/\\/g, '/');
    const text = P.readText(path.join(d, ent.name));
    if (!text || P.hygieneIgnored(text)) continue;
    const hits = text.split('\n').filter((l) => P.HYGIENE_SCAR.test(l)).length;
    if (hits) scarred.push({ file: rel, scars: hits });
  }
};
walk(mapDir);

// 3) 距上次 reconcile 天数
const ageDays = lastStamp ? Math.floor((Date.now() - lastStamp) / 86400000) : -1;

const needsReconcile = [];
for (const f of changedSince) needsReconcile.push({ file: f, why: '自上次 reconcile 有改动' });
for (const s of scarred) {
  if (!needsReconcile.find((n) => n.file === s.file)) needsReconcile.push({ file: s.file, why: `${s.scars} 处疤痕` });
}
if (!needsReconcile.length && ageDays > days) {
  needsReconcile.push({ file: 'docs/map/（全量）', why: `已 ${ageDays} 天未 reconcile（>${days} 天）` });
}

if (jsonMode) {
  console.log(JSON.stringify({ ok: needsReconcile.length === 0, days: ageDays, targets: needsReconcile.map((n) => ({ file: n.file, why: n.why })) }, null, 2));
  process.exit(needsReconcile.length ? 1 : 0);
}

if (needsReconcile.length) {
  console.log(`🧹 建议 reconcile（上次：${lastStamp ? new Date(lastStamp).toISOString().slice(0, 10) : '从未'}，距今天数 ${ageDays}）——${needsReconcile.length} 个目标:`);
  for (const n of needsReconcile) console.log(`   - ${n.file}（${n.why}）`);
  console.log('\n执行方式：重读以上文档全文，逐条核对事实声明是否仍成立（技术栈/路径/状态/决策），');
  console.log('修正矛盾、删除疤痕叙述（corrected/reversed/earlier draft 等），然后运行：node reconcile.mjs <项目> --done');
} else {
  console.log('🧹 无 reconcile 目标，文档卫生良好。');
}

// --done：记录本次 reconcile 时间戳
if (process.argv.includes('--done')) {
  fs.mkdirSync(path.join(target, '.internal'), { recursive: true });
  fs.writeFileSync(stateFile, String(Date.now()), 'utf8');
  console.log('✅ 已记录 reconcile 时间戳（.internal/reconcile-last.txt）。');
}