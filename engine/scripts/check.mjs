#!/usr/bin/env node
// project-map-governance · check.mjs（v3，规则引擎）
// 规则表驱动（governance.json.rules，severity: off|warn|error；error 级触发 exit 1）：
//   dead-links(默认 error) / untracked-strict / relatedness / changelog / semantics
//   size / root-consistency / index-consistency / index-format / doc-hygiene
// legacy 配置（strict/strictLinks/changelog/strictSemantics/links）由 lib-parse.migrateConfig 自动迁移。
// 用法: node check.mjs <项目路径> [--strict] [--json]
// 退出码: 0=无 error 级问题（可带 warn 提示） 1=有 error 级问题 2=参数错误
// --json：只输出结构化结果（插件/MCP 用）：
//   { ok, configVersion, level, dirs, errors: [{rule, problems}], warns: [{rule, problems}] }
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findCrossModuleLinks } from './lib-links.mjs';
import * as P from './lib-parse.mjs';

function usage() { console.error('用法: node check.mjs <项目路径> [--strict] [--json]'); process.exit(2); }

let targetArg = null, cliStrict = false, jsonMode = false;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--strict') cliStrict = true;
  else if (a === '--json') jsonMode = true;
  else if (!a.startsWith('--')) targetArg = a;
}
const target = path.resolve(targetArg || '');
if (!targetArg || !fs.existsSync(target)) usage();

// ---- 治理边界：单源 = lib-parse（勿在本地重复定义）----
const IGNORE_NAMES = P.IGNORE_NAMES;
const isCfgFile = P.isCfgFile;
const isBinary = P.isBinary;
const ROOT_DOC = P.ROOT_DOC;
const stripMarkdown = (s) => s.replace(/^[-*]\s*`?([^`—|]*?)`?.*$/, '$1').trim();

// ---- 配置（自动迁移 legacy → v3 rules）----
const mapDir = path.join(target, 'docs', 'map');
if (!fs.existsSync(mapDir)) { console.error('未找到 docs/map —— 先用 init.mjs 初始化治理。'); process.exit(1); }
const config = P.loadConfig(target); // 迁移并落盘
const level = ['files', 'dirs', 'modules'].includes(config.level) ? config.level : 'files';
const extraIgnore = new Set(Array.isArray(config.ignore) ? config.ignore : []);
const roots = Array.isArray(config.roots) && config.roots.length ? new Set(config.roots) : null;
const rules = { ...P.defaultRules(), ...(config.rules || {}) };
const sev = (id) => rules[id] === 'error' || rules[id] === 'warn' ? rules[id] : 'off';
const isRuleError = (id) => rules[id] === 'error' || (cliStrict && id === 'untracked-strict');
const runGit = (args) => {
  try {
    const r = spawnSync('git', args, { cwd: target, encoding: 'utf8', timeout: 15000 });
    return r.status === 0 ? r.stdout : '';
  } catch { return ''; }
};

const dirs = (function () {
  const out = [];
  let entries; try { entries = fs.readdirSync(target, { withFileTypes: true }); } catch { entries = []; }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (IGNORE_NAMES.has(ent.name) || extraIgnore.has(ent.name) || ent.name.startsWith('.')) continue;
    if (roots && !roots.has(ent.name)) continue;
    out.push(ent.name);
  }
  return out.sort((a, b) => a.localeCompare(b));
})();

// ---- 真实文件 / 地图登记 ----
function getRealFiles(dir, prefix = '') {
  const out = new Set();
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const ent of entries) {
    if (IGNORE_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
    if (prefix === '' && roots && !roots.has(ent.name)) continue;
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) { for (const f of getRealFiles(full, rel)) out.add(f); }
    else if (!isCfgFile(ent.name) && !isBinary(rel)) out.add(rel);
  }
  return out;
}
function getMappedFiles() {
  const mapped = new Set();
  const treeDir = path.join(mapDir, 'tree');
  if (!fs.existsSync(treeDir)) return mapped;
  for (const f of fs.readdirSync(treeDir)) {
    if (!f.endsWith('.md')) continue;
    for (const line of P.readText(path.join(treeDir, f)).split('\n')) {
      const m = line.match(/`([^`]+)`/);
      let p = m ? m[1] : null;
      if (!p) { const s = line.trim(); if (s.startsWith('-')) p = stripMarkdown(s); }
      if (!p) continue;
      if (p.includes(' ') || p.startsWith('#')) continue;
      if (p.includes('*') || p.includes('?') || p.endsWith('/') || p.startsWith('../') || p.startsWith('./')) continue;
      if (!p.includes('/') && !path.extname(p)) continue;
      mapped.add(p);
    }
  }
  return mapped;
}

const real = getRealFiles(target);
const mapped = getMappedFiles();

// ---- 规则执行（每规则产出 problems；severity 决定归类）----
const errors = [];   // [{rule, problems}]
const warns = [];    // [{rule, problems}]
const add = (rule, problems) => {
  if (!problems.length) return;
  if (isRuleError(rule)) errors.push({ rule, problems });
  else warns.push({ rule, problems });
};
const cfgHints = config.hints || {};
const HINT_LINE = cfgHints.maxDocLines ?? 200;
const HINT_INDEX_MODULES = cfgHints.maxIndexModules ?? 15;
const HINT_TREE_NOTED = cfgHints.maxTreeNoted ?? 100;

// 1) dead-links（恒 error）——tree 登记 + 治理文档（root/index/decisions）内本地引用
{
  // 收集 root/、index.md、decisions/ 内指向真实文件的本地引用
  const docRefs = new Set();
  const scanDoc = (file) => {
    const t = P.readText(file);
    if (!t) return;
    for (const ref of P.collectLocalFileRefs(t, path.dirname(file), target)) docRefs.add(ref);
  };
  const rootDir = path.join(mapDir, 'root');
  if (fs.existsSync(rootDir)) for (const f of fs.readdirSync(rootDir)) { if (f.endsWith('.md')) scanDoc(path.join(rootDir, f)); }
  scanDoc(path.join(mapDir, 'index.md'));
  const decDir = path.join(mapDir, 'decisions');
  if (fs.existsSync(decDir)) for (const f of fs.readdirSync(decDir)) { if (f.endsWith('.md')) scanDoc(path.join(decDir, f)); }

  // tree 登记引用：保持旧豁免（tree 不含 docs/ 登记）
  const mappedProblems = [...mapped].filter((p) => {
    if (isCfgFile(path.basename(p))) return false;
    if (isBinary(p)) return false;
    if (p.startsWith('docs/') || p.startsWith('.internal/') || p.startsWith('assets/')) return false;
    return !real.has(p);
  });
  // 治理文档内部引用：全量校验存在性（docs/map 内部互链也查）
  const docProblems = [...docRefs].filter((p) => {
    if (isCfgFile(path.basename(p))) return false;
    if (isBinary(p)) return false;
    return !fs.existsSync(path.join(target, p));
  });
  const problems = [...mappedProblems, ...docProblems.map((p) => `治理文档引用缺失: ${p}`)];
  if (problems.length) add('dead-links', problems);
}

// 2) untracked-strict（files 粒度；error 由 rules/--strict 决定）
{
  let untracked = [...real].filter((p) => !mapped.has(p));
  untracked = untracked.filter((p) => {
    if (p.startsWith('docs/map/')) return false;
    if (ROOT_DOC.has(p)) return false;
    const base = path.basename(p);
    if (base.startsWith('LICENSE') || base.startsWith('README') || base.startsWith('CLAUDE') && path.dirname(p) === '.') return false;
    return true;
  });
  if (untracked.length && (sev('untracked-strict') !== 'off' || cliStrict)) {
    if (level === 'files') {
      add('untracked-strict', untracked);
    } else {
      // 非 files 粒度：即使规则为 error 也只提示（该粒度本就不要求逐文件登记）
      warns.push({ rule: 'untracked-strict', problems: [`粒度 ${level}：${untracked.length} 个文件未登记（当前粒度不要求逐文件登记，如需门禁请在 files 粒度启用）`] });
    }
  }
}

// 3) relatedness（links 扫描；triage 豁免；出边+反向）
{
  const problems = [];
  if (sev('relatedness') !== 'off') {
    const links = findCrossModuleLinks([...real].filter((p) => p.includes('/')), target);
    const triage = new Set();
    const triageFile = path.join(mapDir, 'memo', 'link-triage.md');
    const tt = P.readText(triageFile);
    if (tt) P.extractTriage(tt).forEach((k) => triage.add(k));
    const mentions = (mod, name) => {
      const docText = P.readText(path.join(mapDir, 'root', `${mod}.md`));
      return docText ? P.extractRelatedModules(docText, dirs).has(name) : false;
    };
    for (const l of links) {
      const key = `${l.from} → ${l.to}`;
      if (triage.has(key)) continue;
      if (!mentions(l.from, l.to)) problems.push({ a: l.from, b: l.to, side: 'out' });
      if (!mentions(l.to, l.from)) problems.push({ a: l.from, b: l.to, side: 'rev' });
    }
  }
  add('relatedness', problems);
}

// 4) changelog（git tag 基线）
{
  const problems = [];
  if (sev('changelog') !== 'off') {
    const chg = path.join(target, 'CHANGELOG.md');
    if (!fs.existsSync(chg)) problems.push('缺少 CHANGELOG.md');
    else {
      const text = P.readText(chg);
      if (!/^## \[Unreleased\]/m.test(text)) problems.push('CHANGELOG.md 缺 [Unreleased] 区块');
      if (fs.existsSync(path.join(target, '.git'))) {
        const tag = runGit(['describe', '--tags', '--abbrev=0']).trim();
        if (tag) {
          const changed = runGit(['log', '--oneline', `${tag}..HEAD`, '--', ...(roots ? [...roots] : ['.'])]).split('\n').filter(Boolean).length;
          if (changed > 0) {
            const hasReal = /-(?!\s*无\s*$)(?!\s*-?\s*none\s*$)/m.test(P.extractUnreleased(text) || '');
            if (!hasReal) problems.push('自上次发布有功能提交，但 CHANGELOG [Unreleased] 无实质条目（用户可见变更请记入）');
          }
        } else if (sev('changelog') === 'error' || sev('changelog') === 'warn') {
          // 无 tag 基线：changelog 门禁无从比较，提示规则未生效（不拦截）
          warns.push({ rule: 'changelog', problems: ['仓库无 git tag 基线：changelog 门禁无法生效（打 tag 后此规则才起作用）'] });
        }
      }
    }
  }
  add('changelog', problems);
}

// 5) semantics（职责/负责/影响 待填）——覆盖全部治理 root 文档（目录 + 根级配置文件模块）
{
  const problems = [];
  if (sev('semantics') !== 'off') {
    const govDocs = P.governedRootDocs(target, dirs);
    for (const d of govDocs) {
      const text = P.readText(path.join(mapDir, 'root', `${d}.md`));
      if (!text) continue;
      const fields = P.extractModuleFields(text);
      for (const [label, v] of [['职责', fields.duty], ['负责', fields.owner], ['影响', fields.impact]]) {
        if (v === '（待填）' || v.startsWith('（待填）')) problems.push(`${d}.${label}=（待填）`);
      }
    }
    // 导航概况待填：始终提示（warn 级，不随 strictSemantics 升级为 error——概况是导航增强非核心语义）
    const idx = P.readText(path.join(mapDir, 'index.md'));
    if (idx) {
      const sums = P.extractIndexNavSummaries(idx);
      for (const [mod, sum] of sums) {
        if (!sum || sum === '概况待填' || sum === '职责待填' || sum === '待填') {
          warns.push({ rule: 'semantics', problems: [`index.${mod}.概况=（待填）（导航概况：≤40 字含模块职责要点）`] });
        }
      }
    }
  }
  add('semantics', problems);
}

// 6) size（阈值可配）
{
  const problems = [];
  if (sev('size') !== 'off') {
    const walk = (d) => {
      let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const ent of entries) {
        if (ent.isDirectory()) { walk(path.join(d, ent.name)); continue; }
        if (!ent.name.endsWith('.md')) continue;
        const file = path.join(d, ent.name);
        const text = P.readText(file);
        if (!text) continue;
        const lines = text.split('\n').length;
        if (lines > HINT_LINE) problems.push(`${path.relative(target, file).replace(/\\/g, '/')} 已 ${lines} 行（>${HINT_LINE}），建议按子域拆分到 memo/`);
      }
    };
    walk(mapDir);
    const idx = P.readText(path.join(mapDir, 'index.md'));
    if (idx) {
      const moduleLines = P.extractIndexNav(idx).size;
      if (moduleLines > HINT_INDEX_MODULES) problems.push(`index.md 模块一览已 ${moduleLines} 项（>${HINT_INDEX_MODULES}），建议按域聚合`);
    }
    const treeDir = path.join(mapDir, 'tree');
    if (fs.existsSync(treeDir)) {
      for (const f of fs.readdirSync(treeDir)) {
        if (!f.endsWith('.md')) continue;
        const text = P.readText(path.join(treeDir, f)) || '';
        const noted = text.split('\n').filter((l) => /^- `[^`]+` —/.test(l) && !/^- `[^`]+\/` —/.test(l)).length;
        if (noted > HINT_TREE_NOTED) problems.push(`${f} 关键文件已 ${noted} 个（>${HINT_TREE_NOTED}），建议只留指针 + memo 下钻`);
      }
    }
  }
  add('size', problems);
}

// 7) root-consistency（派生表 vs 模块节单一事实源）
{
  const problems = [];
  if (sev('root-consistency') !== 'off') {
    const content = P.readText(path.join(mapDir, 'root.md'));
    if (content) {
      const parsed = P.parseRootTable(content);
      if (parsed) {
        for (const d of dirs) {
          const text = P.readText(path.join(mapDir, 'root', `${d}.md`));
          const secRel = text ? P.extractRelatedModules(text, dirs) : new Set();
          const row = parsed.rows.get(d);
          if (!row) { problems.push(`root.md 表缺模块行 \`${d}\`（运行 sync 刷新）`); continue; }
          const rowRel = new Set([...(row.related.match(/`([^`]+)`/g) || [])].map((x) => x.slice(1, -1)).filter((x) => dirs.includes(x) && x !== d));
          for (const x of secRel) if (!rowRel.has(x)) problems.push(`root.md 表缺模块节声明的关联 ${d} → ${x}（运行 sync 刷新）`);
          for (const x of rowRel) if (!secRel.has(x)) problems.push(`root.md 表多出模块节未声明的关联 ${d} → ${x}（运行 sync 刷新）`);
          if (text) {
            const f = P.extractModuleFields(text);
            if (row.duty !== f.duty) problems.push(`root.md 表职责与 root/${d}.md 不一致（运行 sync 刷新）`);
            // v3.1："负责"为维护信息，不进派生表（运行时/维护分离）；一致性由 root/<模块>.md 自身维护
          }
        }
      }
    }
  }
  add('root-consistency', problems);
}

// 8) index-consistency
{
  const problems = [];
  if (sev('index-consistency') !== 'off') {
    const idx = P.readText(path.join(mapDir, 'index.md'));
    if (idx) {
      const listed = P.extractIndexNav(idx);
      const missing = dirs.filter((d) => !listed.has(d));
      const extra = [...listed].filter((l) => !dirs.includes(l));
      if (missing.length) problems.push(`index.md 缺模块：${missing.join(',')}（用 sync --reindex 刷新）`);
      if (extra.length) problems.push(`index.md 含已移除模块：${extra.join(',')}（用 sync --reindex 刷新）`);
    }
  }
  add('index-consistency', problems);
}

// 9) index-format（llms.txt 式）
{
  const problems = [];
  if (sev('index-format') !== 'off') {
    const idx = P.readText(path.join(mapDir, 'index.md'));
    if (idx) {
      const lines = idx.split('\n').filter((l) => l.trim());
      if (!lines.length || !lines[0].startsWith('# ')) problems.push('index.md 缺少 H1 标题（llms.txt 式：`# 项目名`）');
      else if (!lines.slice(1, 4).some((l) => l.startsWith('>'))) problems.push('index.md 缺少一句话摘要 blockquote（`> ...`）');
      // v3.1 导航概况规范：仅查"已填概况"格式（超长）；待填归 semantics 规则（index.x.概况）
      // v3.5：移除「概况失真」子串关联判定——中文短概况与职责的词面重叠脆弱（措辞漂移即误报），语义正确性交 reconcile 人读防线
      const sums = P.extractIndexNavSummaries(idx);
      for (const [mod, sum] of sums) {
        if (!sum || sum === '职责待填' || sum === '概况待填' || sum === '待填') continue;
        if (sum.length > 40) problems.push(`index.md 导航 ${mod} 概况 ${sum.length} 字 >40（信息密度优先，控制在 40 字内）`);
      }
    }
  }
  add('index-format', problems);
}

// 10) doc-hygiene（语义陈旧疤痕；豁免标记）
{
  const problems = [];
  if (sev('doc-hygiene') !== 'off') {
    const walk = (d) => {
      let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const ent of entries) {
        if (ent.name === 'tree') continue;
        if (ent.isDirectory()) { walk(path.join(d, ent.name)); continue; }
        if (!ent.name.endsWith('.md')) continue;
        const file = path.join(d, ent.name);
        const text = P.readText(file);
        if (!text || P.hygieneIgnored(text)) continue;
        const hits = text.split('\n').filter((l) => P.HYGIENE_SCAR.test(l));
        if (hits.length) problems.push(`${path.relative(target, file).replace(/\\/g, '/')} 有 ${hits.length} 处文档疤痕（${hits[0].trim().slice(0, 40)}…）——建议全文档 reconcile 重读`);
      }
    };
    walk(mapDir);
  }
  add('doc-hygiene', problems);
}

// 11) user-facts（用户确定事实：active=已确认约束；变更触及→按 severity（默认 error 门禁）；文档完整性→warn 提示）
{
  const problems = [];
  if (sev('user-facts') !== 'off') {
    const factsFile = path.join(mapDir, 'facts.md');
    const facts = fs.existsSync(factsFile) ? P.parseFacts(P.readText(factsFile)) : [];
    for (const f of facts) {
      // 完整性（warn 级提示，不随 error 门禁拦截）
      if (!P.FACT_STATUSES.includes(f.status)) warns.push({ rule: 'user-facts', problems: [`facts ${f.id}「${f.title}」状态非法: ${f.status || '（空）'}（应为 active|superseded）`] });
      else if (f.status === 'active') {
        if (!f.date) warns.push({ rule: 'user-facts', problems: [`facts ${f.id} 状态 active 缺确认日期`] });
        if (!f.scope) warns.push({ rule: 'user-facts', problems: [`facts ${f.id} 状态 active 缺约束范围（check 无法检测变更触及）`] });
        if (!f.statement) warns.push({ rule: 'user-facts', problems: [`facts ${f.id} 状态 active 缺事实陈述`] });
      } else if (f.status === 'superseded' && !f.conflict) {
        warns.push({ rule: 'user-facts', problems: [`facts ${f.id} 状态 superseded 缺冲突处理记录（原由/新方向/用户决策）`] });
      }
    }
    // 变更触及 active 事实的约束范围 → 按 rules.user-facts severity（默认 error 门禁）
    const staged = runGit(['diff', '--cached', '--name-only']).split('\n').map((s) => s.trim()).filter(Boolean);
    const changed = staged.length
      ? staged
      : runGit(['diff', '--name-only']).split('\n').map((s) => s.trim()).filter(Boolean); // 无 staged 时退回工作区 diff
    if (changed.length) {
      for (const f of facts) {
        if (f.status !== 'active') continue;
        for (const scope of P.factScopeList(f)) {
          // scope 匹配：路径前缀（去尾斜杠）/ 模块名 / 关键词（归一化斜杠）
          const normScope = scope.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
          const hit = changed.some((c) => {
            const nc = c.replace(/\\/g, '/');
            return nc === normScope || nc.startsWith(normScope + '/') || (normScope.includes('/') === false && nc.split('/').includes(normScope));
          });
          if (hit) { problems.push(`变更触及用户确定事实 ${f.id}「${f.title}」（约束范围 ${scope}）——用户已确认，禁止破坏；如需变更请先询问用户并更新 facts.md`); break; }
        }
      }
    }
  }
  add('user-facts', problems);
}

// 12) adr-status-consistency（decisions/README 状态列 ↔ ADR 文件状态行；状态行选项菜单残留=模板疤痕）
{
  const problems = [];
  if (sev('adr-status-consistency') !== 'off') {
    const decDir = path.join(mapDir, 'decisions');
    const idxFile = path.join(decDir, 'README.md');
    if (fs.existsSync(idxFile)) {
      const index = P.parseAdrIndex(P.readText(idxFile));
      for (const [id, row] of index) {
        if (!['proposed', 'accepted', 'deprecated', 'superseded'].includes(row.status)) {
          problems.push(`decisions/README ${id} 状态列非法: ${row.status || '（空）'}（应为 proposed|accepted|deprecated|superseded）`);
          continue;
        }
        const file = path.join(decDir, `${id}.md`);
        if (!fs.existsSync(file)) continue; // 死链由 dead-links 管
        const st = P.parseAdrStatusLine(P.readText(file));
        if (!st) problems.push(`${id}.md 缺「> 状态：」行（decisions/README 列为 ${row.status}）`);
        else if (st.residue) problems.push(`${id}.md 状态行残留选项菜单「${st.raw.slice(0, 40)}」——应只写单一状态词（模板疤痕，见 adr.mjs）`);
        else if (st.status !== row.status) problems.push(`${id}.md 状态行「${st.status}」与 decisions/README 状态列「${row.status}」不一致（拍板后请同步两处）`);
      }
      // ADR 文件存在但索引未登记 → 漏登记提示
      for (const f of fs.readdirSync(decDir)) {
        const m = f.match(/^(ADR-\d+)\.md$/);
        if (m && !index.has(m[1])) problems.push(`${m[1]}.md 未登记到 decisions/README.md 索引表`);
      }
    }
  }
  add('adr-status-consistency', problems);
}

// 13) nav-depth（导航可达性：从 AGENTS/CLAUDE 起 ≤N 跳；「3 次检索预算」门禁）
{
  const problems = [];
  if (sev('nav-depth') !== 'off') {
    const maxDepth = (cfgHints.navMaxDepth ?? 3);
    const audit = P.navDepthAudit(target, mapDir, maxDepth);
    for (const d of audit.unreachable) problems.push(`${d} 从治理入口不可达（无任何文档指针指向）——补入链（index/AGENTS/root 内加「见 …」指针）`);
    for (const { doc, depth } of audit.deep) problems.push(`${doc} 距入口 ${depth} 跳 > 预算 ${maxDepth}（模型 3 次检索内应触达所有受影响文档）——压缩层级或提升入链层级`);
  }
  add('nav-depth', problems);
}

// 14) tree-duty（tree/*.md 文件职责待填补齐提示——文件级地图的「每文件一句职责」是下钻价值所在）
{
  const problems = [];
  if (sev('tree-duty') !== 'off') {
    const treeDir = path.join(mapDir, 'tree');
    if (fs.existsSync(treeDir)) {
      for (const f of fs.readdirSync(treeDir)) {
        if (!f.endsWith('.md')) continue;
        const relPath = `docs/map/tree/${f}`;
        const text = P.readText(path.join(treeDir, f));
        if (!text) continue;
        const hits = text.split('\n').filter((l) => /^- `[^`]+` —/.test(l) && /\(职责待填\)/.test(l)).length;
        if (hits) problems.push(`${relPath} 有 ${hits} 个文件职责待填（每文件一句：是什么/入口在哪，≤30 字）`);
      }
    }
  }
  add('tree-duty', problems);
}

// ---- 规则注册完整性断言（防漏注册静默失效：新增规则须在 check 加块 + 此处登记 + lib-parse RULE_IDS）----
{
  // 实际执行了规则块的 id（每块 add() 的规则名）
  const executed = new Set(['dead-links', 'untracked-strict', 'relatedness', 'changelog', 'semantics', 'size', 'root-consistency', 'index-consistency', 'index-format', 'doc-hygiene', 'user-facts', 'adr-status-consistency', 'nav-depth', 'tree-duty']);
  const reg = P.assertRuleRegistry(executed);
  if (!reg.ok) {
    const msg = `规则注册不一致: 缺 ${reg.missing.join(',')} / 多余 ${reg.extra.join(',')}（检查 check 规则块与 lib-parse RULE_IDS）`;
    if (jsonMode) { console.log(JSON.stringify({ ok: false, errors: [{ rule: 'registry', problems: [msg] }], warns: [] })); }
    else console.error(`⛔ ${msg}`);
    process.exit(1);
  }
}

// ---- 输出 ----
const fmtProblems = (probs) => probs.map((p) => {
  if (typeof p === 'object') {
    return p.side === 'rev'
      ? `代码引用 ${p.a} → ${p.b}：root/${p.b}.md「相关模块」未标记反向影响（改 ${p.b} 需回归 ${p.a}）`
      : `代码引用 ${p.a} → ${p.b}，但 root/${p.a}.md「相关模块」无标记（防开发漂移）`;
  }
  return p;
});

if (jsonMode) {
  console.log(JSON.stringify({
    ok: errors.length === 0,
    configVersion: config.configVersion,
    level,
    dirs,
    errors: errors.map((e) => ({ rule: e.rule, problems: fmtProblems(e.problems) })),
    warns: warns.map((w) => ({ rule: w.rule, problems: fmtProblems(w.problems) })),
  }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

const LABELS = {
  'dead-links': '⛔ 地图引用了 %n 个已不存在的文件:',
  'untracked-strict': '⛔ strict 模式（粒度 files）：%n 个真实文件未登记在地图:',
  'relatedness': '⛔ strictLinks：%n 条跨模块关联缺「相关模块」标记（确认后填入 root/*.md，或登记 docs/map/memo/link-triage.md 豁免）:',
  'changelog': '⛔ changelog（required）：',
  'semantics': '⛔ strictSemantics：%n 个模块语义字段仍为（待填）:',
};
const WARN_PREFIX = { size: '📏', relatedness: '🔗', 'root-consistency': '📚', 'index-consistency': '📚', semantics: '📚', changelog: '📚', 'index-format': '📐', 'doc-hygiene': '🧹', 'adr-status-consistency': '📋', 'nav-depth': '🧭', 'tree-duty': '📝', 'untracked-strict': 'ℹ️' };

let blocked = false;
for (const e of errors) {
  const label = LABELS[e.rule] || `⛔ ${e.rule}：`;
  if (e.rule === 'changelog') console.log(`${label}${fmtProblems(e.problems).join('；')}`);
  else if (e.rule === 'relatedness') {
    const pairCount = new Set(e.problems.map((p) => `${p.a} → ${p.b}`)).size;
    console.log(label.replace('%n', pairCount));
    const seen = new Set();
    fmtProblems(e.problems).forEach((p) => { const k = p.slice(0, 24); if (!seen.has(k)) { seen.add(k); console.log(`   - ${p}`); } });
  } else {
    console.log(label.replace('%n', e.problems.length));
    e.problems.slice(0, 20).forEach((p) => console.log(`   - ${p}`));
    if (e.problems.length > 20) console.log(`   …等 ${e.problems.length - 20} 个`);
  }
  blocked = true;
}
const warnList = warns.flatMap((w) => fmtProblems(w.problems).map((p) => `${WARN_PREFIX[w.rule] || '📋'} ${p}`));
if (warnList.length) {
  console.log(`\n—— 审查提示（非阻塞，${warnList.length} 条）——`);
  warnList.forEach((h) => console.log(`  ${h}`));
}
if (!blocked) console.log('✅ 地图与代码一致，无漂移。');
if (!blocked && warnList.length) console.log('（提示不影响提交；视需要处理）');
process.exit(blocked ? 1 : 0);