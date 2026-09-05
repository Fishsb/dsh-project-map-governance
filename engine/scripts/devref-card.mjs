#!/usr/bin/env node
// project-map-governance · devref-card.mjs — 项目知识卡库写门（ADR-0005 决策 5）
// 语义：route=project 的知识卡唯一写入口。卡册三件：cards/how-to.md | cards/reference.md | cards/decision.md + INDEX.md。
// 安全阀（对齐 memory-append/knowledge-append）：①卡册不存在→exit 2 列出可册（不自动建散落卡册）
//        ②写前备份 ③INDEX 登记幂等 ④正文限长 ⑤溯源必带（[来源:…]）⑥双查纪律行幂等写 AGENTS
// 用法:
//   node devref-card.mjs <项目路径> --title <标题> --card-type how-to|reference|decision --text <正文> --source <溯源> [--dir docs/devref] [--status proposed|accepted]
//   node devref-card.mjs <项目路径> --list [--dir docs/devref]           # 卡清单
//   node devref-card.mjs <项目路径> --init [--dir docs/devref]           # 初始化卡库骨架（INDEX + 三卡册）
// 退出码: 0=成功 1=失败 2=参数/卡册非法 3=用法错误
import fs from 'node:fs';
import path from 'node:path';

const CARD_TYPES = {
  'how-to': { file: 'cards/how-to.md', label: '操作步骤' },
  'reference': { file: 'cards/reference.md', label: '契约事实' },
  'decision': { file: 'cards/decision.md', label: '架构决策' },
};
const TEXT_LIMIT = 2000;
const INDEX_LIMIT = 200; // INDEX 行数软上限（超限提示拆册，不拦截）

function usage() {
  console.error('用法: node devref-card.mjs <项目路径> --title <标题> --card-type how-to|reference|decision --text <正文> --source <溯源> [--dir docs/devref] | --list | --init');
  process.exit(3);
}

function parseArgs(argv) {
  const args = { dir: 'docs/devref', positional: [] };
  const opts = { 'title': 'title', 'card-type': 'cardType', 'text': 'text', 'source': 'source', 'dir': 'dir', 'status': 'status' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--init') args.init = true;
    else if (opts[a.slice(2)]) { args[opts[a.slice(2)]] = argv[i + 1]; i++; }
    else if (a.startsWith('--')) { console.error(`未知参数: ${a}`); usage(); }
    else args.positional.push(a);
  }
  return args;
}

const slugify = (t) => t.replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'card';
const today = () => new Date().toISOString().slice(0, 10);

function ensureGitIgnore(project) {
  const f = path.join(project, '.gitignore');
  if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('docs/devref/')) return;
  fs.appendFileSync(f, '\n# ---- 项目知识卡库（本地治理，不推 GitHub；官方参考用 devref.mjs 部署）----\ndocs/devref/\n', 'utf8');
}

function registerAgentsDualCheck(project, dir) {
  // 双查纪律：AGENTS.md 追加一行（幂等）——过渡期查开发知识需「项目卡库 + 记忆库」双查
  const f = path.join(project, 'AGENTS.md');
  if (!fs.existsSync(f)) return false;
  let c = fs.readFileSync(f, 'utf8');
  const line = `- **开发知识双查纪律（ADR-0005，过渡期）**：查开发契约/踩坑 → ${dir}/cards/（项目卡库）与记忆库 notes/ **双查并列**（记忆开发知识迁移完成前无权威方；迁移完成后卡库权威）。`;
  if (c.includes('开发知识双查纪律')) return false;
  c = c.replace(/\n$/, '') + '\n' + line + '\n';
  fs.writeFileSync(f, c, 'utf8');
  return true;
}

function initLibrary(project, dir) {
  const base = path.join(project, dir);
  const cardsDir = path.join(base, 'cards');
  fs.mkdirSync(cardsDir, { recursive: true });
  const date = today();
  for (const [id, meta] of Object.entries(CARD_TYPES)) {
    const f = path.join(base, meta.file);
    if (!fs.existsSync(f)) {
      fs.writeFileSync(f, `# 项目知识卡册 · ${meta.label}（${id}）\n\n> route=project 知识卡按类型归册。小节名=卡标题（稳定锚，改名需同步 INDEX）。\n\n`, 'utf8');
    }
  }
  const indexFile = path.join(base, 'INDEX.md');
  if (!fs.existsSync(indexFile)) {
    fs.writeFileSync(indexFile, `# docs/devref/cards INDEX — 项目知识卡索引\n\n> 三卡册（how-to/reference/decision）的条目登记表；维护/门禁校验视角。\n\n| 卡 | 册 | 创建 | 溯源 | 状态 |\n|---|---|---|---|---|\n`, 'utf8');
  }
  ensureGitIgnore(project);
  registerAgentsDualCheck(project, dir);
  console.log(`✅ 卡库就绪：${base}\\cards\\（三卡册 + INDEX）+ AGENTS 双查纪律`);
  return 0;
}

function backup(cardFile, relName) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakDir = path.join(path.dirname(cardFile), '..', '..', '.internal', 'backup-' + ts.replace(/[-T:]/g, '').slice(0, 12));
  try { fs.mkdirSync(bakDir, { recursive: true }); fs.copyFileSync(cardFile, path.join(bakDir, relName.replace(/\//g, '_'))); return bakDir; } catch { return null; }
}

function addCard(project, args) {
  const { title, cardType, text, source, dir } = args;
  if (!title || !text || !source) { console.error('--title/--text/--source 必填（溯源必带）'); process.exit(2); }
  if (!CARD_TYPES[cardType]) { console.error(`card-type 非法: ${cardType}（how-to|reference|decision）`); process.exit(2); }
  if (text.length > TEXT_LIMIT) { console.error(`exit=2 正文超限 ${text.length}/${TEXT_LIMIT}（拆卡或下沉项目文档）`); process.exit(2); }

  const base = path.join(project, dir);
  const cardFile = path.join(base, CARD_TYPES[cardType].file);
  if (!fs.existsSync(cardFile)) {
    console.error(`卡册不存在: ${CARD_TYPES[cardType].file}（先 --init 建卡库骨架；不自动建散落卡册）`);
    console.error('可用卡册：cards/how-to.md | cards/reference.md | cards/decision.md');
    process.exit(2);
  }

  const bak = backup(cardFile, CARD_TYPES[cardType].file);
  const raw = fs.readFileSync(cardFile, 'utf8');
  const card = `\n## ${title}（${today()}）\n- 溯源：${source}\n- 状态：${args.status || 'accepted'}\n${text.split('\n').map((l) => '- ' + l).join('\n')}\n`;
  fs.writeFileSync(cardFile, raw.replace(/\s+$/, '\n') + card, 'utf8');

  // INDEX 登记（幂等：同题重跑提示不重复登记）
  const indexFile = path.join(base, 'INDEX.md');
  if (fs.existsSync(indexFile)) {
    let idx = fs.readFileSync(indexFile, 'utf8');
    if (!idx.includes(`| ${title} |`)) {
      const lines = idx.trimEnd().split('\n');
      const lineCount = lines.filter((l) => l.startsWith('| `')).length;
      if (lineCount >= INDEX_LIMIT) console.error(`⚠ INDEX 达 ${INDEX_LIMIT} 行软上限（建议拆册）`);
      idx = idx.replace(/\n$/, '') + `\n| ${title} | ${cardType} | ${today()} | ${source} | ${args.status || 'accepted'} |\n`;
      fs.writeFileSync(indexFile, idx, 'utf8');
    } else {
      console.log('  ℹ INDEX 已有同题条目，跳过登记');
    }
  }

  const anchor = `${CARD_TYPES[cardType].file} §${title}`;
  console.log(`✅ 卡已入册: ${anchor}${bak ? `（备份 ${path.relative(project, bak)}）` : ''}`);
  console.log(`   检索: node read_section 式锚读 或 grep "${title}" ${dir}/cards/`);
  return 0;
}

function listCards(project, dir) {
  const base = path.join(project, dir);
  const indexFile = path.join(base, 'INDEX.md');
  if (!fs.existsSync(indexFile)) { console.log('卡库未初始化（--init 建骨架）'); return 0; }
  const rows = fs.readFileSync(indexFile, 'utf8').split('\n').filter((l) => l.startsWith('| `') || / \|\s*(how-to|reference|decision)\s*\|/.test(l));
  const cards = fs.readFileSync(indexFile, 'utf8').split('\n').filter((l) => /^\| .+ \| (how-to|reference|decision) \|/.test(l));
  console.log(`卡库 ${base}\\：${cards.length} 张卡`);
  cards.forEach((l) => console.log('  ' + l));
  return 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.positional[0] ? path.resolve(args.positional[0]) : null;
  if (!target || !fs.existsSync(target)) usage();
  if (args.init) process.exit(initLibrary(target, args.dir));
  if (args.list) process.exit(listCards(target, args.dir));
  process.exit(addCard(target, args));
}

main();
