#!/usr/bin/env node
// project-map-governance · adr.mjs（v2.2）
// 架构决策记录（ADR）捕获：从模板新建 ADR-NNNN.md 并登记到 decisions/README.md 索引。
// 用法: node adr.mjs <项目路径> "<决策标题>" [--status proposed|accepted]
import fs from 'node:fs';
import path from 'node:path';

function usage() { console.error('用法: node adr.mjs <项目路径> "<决策标题>" [--status proposed|accepted]'); process.exit(2); }

let targetArg = null, title = null, status = 'proposed';
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--status') status = (process.argv[++i] || 'proposed').toLowerCase();
  else if (!targetArg) targetArg = a;
  else if (!title) title = a;
  else usage();
}
if (!targetArg || !title) usage();
const target = path.resolve(targetArg);
if (!fs.existsSync(target)) { console.error(`项目路径不存在: ${target}`); process.exit(1); }
const decDir = path.join(target, 'docs', 'map', 'decisions');
if (!fs.existsSync(decDir)) { console.error('未找到 docs/map/decisions —— 先用 init.mjs 初始化治理。'); process.exit(1); }

let max = 0;
for (const f of fs.readdirSync(decDir)) {
  const m = f.match(/^ADR-(\d+)\.md$/);
  if (m) max = Math.max(max, parseInt(m[1], 10));
}
const n = String(max + 1).padStart(4, '0');
const date = new Date().toISOString().slice(0, 10);
const tpl = path.join(decDir, '_template.md');
const body = fs.existsSync(tpl)
  ? fs.readFileSync(tpl, 'utf8').replace('ADR-0000', `ADR-${n}`).replace('<标题>', title)
  : [
      `# ADR-${n}：${title}`,
      '', '> 状态：proposed', '',
      '## 背景', '', '## 决策', '', '## 后果', '', '## 替代方案', '', '## 日期', '',
    ].join('\n');
// 状态行只写单一状态词（选项菜单残留会被 adr-status-consistency 规则拦截为模板疤痕）
const file = path.join(decDir, `ADR-${n}.md`);
fs.writeFileSync(file, body.replace(/^> 状态：.*$/m, `> 状态：${status}`), 'utf8');

// 登记 README 索引
const readme = path.join(decDir, 'README.md');
if (fs.existsSync(readme)) {
  let txt = fs.readFileSync(readme, 'utf8');
  if (!txt.includes(`ADR-${n}`)) {
    if (txt.includes('|---|---|---|') || txt.includes('|---|---|---|---|')) {
      // 插到表头分隔行后
      const sepIdx = txt.search(/\|-[-|\s]*\|/g);
      const insertAt = sepIdx >= 0 ? txt.indexOf('\n', sepIdx) + 1 : txt.length;
      txt = txt.slice(0, insertAt) + `| ADR-${n} | ${title} | ${status} | ${date} |\n` + txt.slice(insertAt);
    } else {
      txt += `| ADR-${n} | ${title} | ${status} | ${date} |\n`;
    }
    fs.writeFileSync(readme, txt, 'utf8');
  }
}

console.log(`✅ 已创建 ADR-${n}：${path.relative(target, file)}（状态 ${status}）`);
console.log('   打开补充「背景/决策/后果/替代方案」。拍板后把状态推进到 accepted：');
console.log(`   同步两处 = 本文件「> 状态：」行 + decisions/README.md 状态列（adr-status-consistency 规则强制一致，error 门禁）。`);