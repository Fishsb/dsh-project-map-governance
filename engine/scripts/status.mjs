#!/usr/bin/env node
// project-map-governance · status.mjs（v3）
// 治理状态快照（插件/MCP/人通用）：配置、粒度、模块、关键文档存在性、ADR 数、reconcile 天数。
// 用法: node status.mjs <项目路径> [--json]
import fs from 'node:fs';
import path from 'node:path';
import * as P from './lib-parse.mjs';

let targetArg = null, jsonMode = false;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--json') jsonMode = true;
  else if (!a.startsWith('--')) targetArg = a;
}
if (!targetArg) { console.error('用法: node status.mjs <项目路径>'); process.exit(2); }
const target = path.resolve(targetArg);
if (!fs.existsSync(target)) { console.error(`项目路径不存在: ${target}`); process.exit(1); }
const mapDir = path.join(target, 'docs', 'map');
const hasMap = fs.existsSync(mapDir);

let state = {
  governed: hasMap,
  path: target,
};
if (hasMap) {
  const config = P.loadConfig(target);
  const level = ['files', 'dirs', 'modules'].includes(config.level) ? config.level : 'files';
  state = {
    ...state,
    configVersion: config.configVersion,
    level,
    roots: Array.isArray(config.roots) ? config.roots : [],
    rules: config.rules || {},
    modules: (function () {
      const out = [];
      const IGNORE = ['docs', '.internal', 'assets', '.git', 'node_modules', 'dist', 'build'];
      try {
        for (const ent of fs.readdirSync(target, { withFileTypes: true })) {
          if (!ent.isDirectory() || ent.name.startsWith('.') || IGNORE.includes(ent.name)) continue;
          if (config.roots && config.roots.length && !config.roots.includes(ent.name)) continue;
          out.push(ent.name);
        }
      } catch {}
      return out.sort();
    })(),
    hasIndex: fs.existsSync(path.join(mapDir, 'index.md')),
    hasRoot: fs.existsSync(path.join(mapDir, 'root.md')),
    hasConfig: fs.existsSync(path.join(mapDir, 'governance.json')),
    treeFiles: fs.existsSync(path.join(mapDir, 'tree')) ? fs.readdirSync(path.join(mapDir, 'tree')).filter((f) => f.endsWith('.md')).length : 0,
    adrCount: fs.existsSync(path.join(mapDir, 'decisions')) ? fs.readdirSync(path.join(mapDir, 'decisions')).filter((f) => /^ADR-\d+\.md$/.test(f)).length : 0,
  };
  const stamp = (() => { try { return parseInt(fs.readFileSync(path.join(target, '.internal', 'reconcile-last.txt'), 'utf8').trim(), 10) || 0; } catch { return 0; } })();
  state.lastReconcileDays = stamp ? Math.floor((Date.now() - stamp) / 86400000) : -1;
  const probs = P.validateConfig(config);
  state.configProblems = probs;
}

if (jsonMode) { console.log(JSON.stringify(state, null, 2)); }
else {
  if (!hasMap) console.log(`ℹ️ 未治理：${state.path}（运行 init 初始化）`);
  else {
    console.log(`目标: ${state.path}`);
    console.log(`配置 v${state.configVersion} · 粒度 ${state.level} · 模块 ${state.modules.length} 个（${state.modules.join(', ') || '—'}）`);
    console.log(`index:${state.hasIndex ? '✓' : '✗'} root:${state.hasRoot ? '✓' : '✗'} config:${state.hasConfig ? '✓' : '✗'} tree:${state.treeFiles} adr:${state.adrCount}`);
    console.log(`最近 reconcile：${state.lastReconcileDays < 0 ? '从未' : state.lastReconcileDays + ' 天前'}`);
    if (state.configProblems.length) console.log(`⚠ 配置问题：${state.configProblems.join('；')}`);
  }
}
process.exit(hasMap && state.configProblems.length ? 1 : 0);