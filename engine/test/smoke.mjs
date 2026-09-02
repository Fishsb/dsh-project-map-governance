#!/usr/bin/env node
// project-map-governance v2 冒烟回归：T1 小项目 files 档 / T2 dirs 自动降档 / T3 v1 迁移+手动降档
// T4 --links 关联候选与守恒提示 / T5 规模审查提示 / T6 devref 端到端 / T7 白名单 roots
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';

const SKILL = 'C:/Users/lk/.dsh/skills/project-map-governance/scripts';
const NODE = process.execPath;
const BASE = path.resolve('.gov-bench', 'smoke');
fs.rmSync(BASE, { recursive: true, force: true });
fs.mkdirSync(BASE, { recursive: true });

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? '\n     ' + extra.slice(0, 600).replace(/\n/g, '\n     ') : ''}`); }
};
const run = (args) => {
  const r = spawnSync(NODE, args, { encoding: 'utf8', timeout: 120000 });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

// ============ T1 小项目：files 级（默认） ============
console.log('\n[T1] 小项目 files 级');
const small = path.join(BASE, 'small');
for (const d of ['src', 'lib', 'assets']) fs.mkdirSync(path.join(small, d), { recursive: true });
fs.writeFileSync(path.join(small, 'assets', 'logo.png'), 'x');
for (let i = 0; i < 30; i++) fs.writeFileSync(path.join(small, 'src', `f${i}.js`), `export const x=${i};\n`);
for (let i = 0; i < 10; i++) fs.writeFileSync(path.join(small, 'lib', `g${i}.js`), `export const x=${i};\n`);

let r = run([path.join(SKILL, 'init.mjs'), small]);
check('init 成功(exit0)', r.status === 0, r.out);
check('粒度自动=files', /粒度: files/.test(r.out), r.out.slice(-400));
check('AGENTS.md 生成且是收缩版', fs.existsSync(path.join(small, 'AGENTS.md')) && /^## 规则/m.test(fs.readFileSync(path.join(small, 'AGENTS.md'), 'utf8')));
check('CLAUDE.md 生成且同内容', fs.existsSync(path.join(small, 'CLAUDE.md')) && fs.readFileSync(path.join(small, 'CLAUDE.md'), 'utf8') === fs.readFileSync(path.join(small, 'AGENTS.md'), 'utf8'));
check('governance.json 写入', fs.existsSync(path.join(small, 'docs/map/governance.json')));
check('assets 不入模块（回归）', !fs.existsSync(path.join(small, 'docs/map/tree/assets.md')));
check('tree/src.md 全量 30 行', fs.readFileSync(path.join(small, 'docs/map/tree/src.md'), 'utf8').split('\n').filter((l) => l.trim().startsWith('- `')).length === 30);
check('index.md llms.txt 式(H1+摘要)', /^# /.test(fs.readFileSync(path.join(small, 'docs/map/index.md'), 'utf8')) && /^> /m.test(fs.readFileSync(path.join(small, 'docs/map/index.md'), 'utf8')));
check('root/src.md 含「相关模块」节', fs.readFileSync(path.join(small, 'docs/map/root/src.md'), 'utf8').includes('## 相关模块'));
check('.gitignore 含 .internal/', fs.readFileSync(path.join(small, '.gitignore'), 'utf8').includes('.internal/'));

r = run([path.join(SKILL, 'sync.mjs'), small]); // 首次：填充 root.md 派生表
r = run([path.join(SKILL, 'sync.mjs'), small]);
check('sync 幂等(第二次 0 处更新)', /0 处更新/.test(r.out), r.out.slice(-300));
r = run([path.join(SKILL, 'check.mjs'), small]);
check('check 一致 exit0', r.status === 0, r.out);
check('check 无任何提示', !/📏|🔗|📐/.test(r.out), r.out.slice(-400));

fs.writeFileSync(path.join(small, 'src', 'newfile.js'), 'export const n=1;\n');
r = run([path.join(SKILL, 'check.mjs'), small]);
check('非 strict：新文件不拦截', r.status === 0, r.out);
r = run([path.join(SKILL, 'check.mjs'), small, '--strict']);
check('--strict：新文件拦截 exit1', r.status === 1, r.out.slice(-300));
fs.rmSync(path.join(small, 'src', 'newfile.js'), { force: true });

fs.rmSync(path.join(small, 'src', 'f0.js'));
r = run([path.join(SKILL, 'check.mjs'), small]);
check('死链拦截 exit1', r.status === 1 && /已不存在/.test(r.out), r.out.slice(-300));
fs.writeFileSync(path.join(small, 'src', 'f0.js'), 'export const x=0;\n');
run([path.join(SKILL, 'sync.mjs'), small]);
r = run([path.join(SKILL, 'check.mjs'), small]);
check('sync 后恢复一致', r.status === 0, r.out.slice(-300));

// ============ T2 中型：dirs 自动降档 ============
console.log('\n[T2] 中型 dirs 自动降档');
const mid = path.join(BASE, 'mid');
fs.mkdirSync(path.join(mid, 'src'), { recursive: true });
for (let i = 0; i < 600; i++) fs.writeFileSync(path.join(mid, 'src', `f${String(i).padStart(4, '0')}.js`), 'export const x=1;\n');
r = run([path.join(SKILL, 'init.mjs'), mid]);
check('粒度自动=dirs', /粒度: dirs/.test(r.out), r.out.slice(-400));
const midTree = fs.readFileSync(path.join(mid, 'docs/map/tree/src.md'), 'utf8');
check('dirs 级 tree 无全量文件行', !/^- `src\/f\d+\.js` — \(/.test(midTree), midTree.slice(0, 300));
check('dirs 级含未登记统计', /另 600 个文件未登记/.test(midTree), midTree.slice(0, 300));
r = run([path.join(SKILL, 'check.mjs'), mid]);
check('dirs 级 check exit0', r.status === 0, r.out.slice(-300));
r = run([path.join(SKILL, 'sync.mjs'), mid, '--list', 'src']);
check('--list 全量输出且不落盘', r.status === 0 && /src\/f\d+\.js/.test(r.out) && /未写盘/.test(r.out), r.out.slice(-200));
// 关键文件注记 → 出现在 tree
const midTreeFile = path.join(mid, 'docs/map/tree/src.md');
fs.writeFileSync(midTreeFile, fs.readFileSync(midTreeFile, 'utf8') + '- `src/f0000.js` — (18 B) 入口核心\n');
r = run([path.join(SKILL, 'sync.mjs'), mid]);
check('dirs 级职责行被保留', /src\/f0000\.js/.test(fs.readFileSync(midTreeFile, 'utf8')), fs.readFileSync(midTreeFile, 'utf8').slice(0, 500));

// ============ T3 v1 迁移 + 手动降档 modules ============
console.log('\n[T3] v1 迁移 + modules 档');
const mig = path.join(BASE, 'mig');
fs.mkdirSync(path.join(mig, 'src'), { recursive: true });
for (let i = 0; i < 15; i++) fs.writeFileSync(path.join(mig, 'src', `f${i}.js`), 'export const x=1;\n');
const migMap = path.join(mig, 'docs/map');
fs.mkdirSync(path.join(migMap, 'tree'), { recursive: true });
fs.mkdirSync(path.join(migMap, 'root'), { recursive: true });
fs.writeFileSync(path.join(migMap, 'tree', 'src.md'), '# 文件索引 · src\n\n> 由 init.mjs 扫描生成。\n\n- `src/f0.js` — (10 B) (职责待填)\n- `src/f1.js` — (10 B) 核心入口\n');
fs.writeFileSync(path.join(migMap, 'index.md'), '# 旧索引\n');
r = run([path.join(SKILL, 'sync.mjs'), mig]);
check('v1→v2 迁移 sync exit0', r.status === 0, r.out.slice(-400));
check('迁移保留职责注记', fs.readFileSync(path.join(migMap, 'tree/src.md'), 'utf8').includes('核心入口'));
r = run([path.join(SKILL, 'check.mjs'), mig]);
check('迁移后 check exit0', r.status === 0, r.out.slice(-300));
fs.writeFileSync(path.join(migMap, 'governance.json'), JSON.stringify({ level: 'modules' }, null, 2));
r = run([path.join(SKILL, 'sync.mjs'), mig]);
check('modules 档 sync exit0', r.status === 0, r.out.slice(-400));
check('modules 档 tree 无文件行', !/- `src\/f\d+\.js` —/.test(fs.readFileSync(path.join(migMap, 'tree/src.md'), 'utf8')));
r = run([path.join(SKILL, 'check.mjs'), mig]);
check('modules 档 check exit0', r.status === 0, r.out.slice(-300));

// ============ T4/T8 关联闭环（自扫描 + 相对导入 + 双向 + triage + strictLinks） ============
console.log('\n[T4] 关联闭环');
const links = path.join(BASE, 'links');
for (const d of ['features', 'ui', 'extras']) fs.mkdirSync(path.join(links, d), { recursive: true });
fs.writeFileSync(path.join(links, 'features', 'x.js'), "import { View } from 'ui/view.js';\nexport const f = (v) => View(v);\n");
fs.writeFileSync(path.join(links, 'features', 'y.js'), "import { z } from '../ui/z.js';\nexport const y = 1;\n");
fs.writeFileSync(path.join(links, 'ui', 'view.js'), "export const View = (v) => v;\n");
fs.writeFileSync(path.join(links, 'ui', 'z.js'), 'export const z = 1;\n');
fs.writeFileSync(path.join(links, 'extras', 'helper.js'), 'export const h = 1;\n');
run([path.join(SKILL, 'init.mjs'), links, '--links']);
check('init --links 写入 config.links=true', JSON.parse(fs.readFileSync(path.join(links, 'docs/map/governance.json'), 'utf8')).links === true);

// 闭环自足（G1）：删掉瞬态 .internal 后 check 仍能自己扫出问题
fs.rmSync(path.join(links, '.internal'), { recursive: true, force: true });
r = run([path.join(SKILL, 'check.mjs'), links]);
check('G1 闭环自足：无 .internal 仍提示出边', r.status === 0 && /🔗 代码引用 features → ui/.test(r.out), r.out.slice(-600));
check('G2 反向边提示', /🔗 代码引用 features → ui：root\/ui\.md/.test(r.out), r.out.slice(-600));
check('G3 相对导入检出（y.js→ui）', /features → ui/.test(r.out), r.out.slice(-600));

// sync --links 仍是预览工具：候选落盘 + 计数含相对导入
r = run([path.join(SKILL, 'sync.mjs'), links, '--links']);
check('--links 预览落盘', fs.existsSync(path.join(links, '.internal', 'link-candidates.txt')), r.out.slice(-500));

// 双向往相关模块填标记 → 提示消除
const fillBoth = (repo) => {
  for (const [a, b] of [['features', 'ui'], ['ui', 'features']]) {
    const doc = path.join(repo, 'docs/map/root', `${a}.md`);
    const txt = fs.readFileSync(doc, 'utf8');
    if (txt.includes(`- \`${b}\``)) continue;
    fs.writeFileSync(doc, txt.replace('- （待填）`<模块或文件路径>` — 与<本模块>的关系', `- \`${b}\` — 关联（改${a}需检查${b}）`));
  }
};
fillBoth(links);
r = run([path.join(SKILL, 'check.mjs'), links]);
check('双向往标记后提示消除', r.status === 0 && !/🔗 代码引用/.test(r.out), r.out.slice(-600));

// triage 豁免（G4）：新边 features→extras 登记噪音后不提示
fs.writeFileSync(path.join(links, 'features', 'w.js'), "import { h } from 'extras/helper.js';\nexport const w = 1;\n");
r = run([path.join(SKILL, 'check.mjs'), links]);
check('新边未处理时提示出现', /🔗 代码引用 features → extras/.test(r.out), r.out.slice(-600));
fs.mkdirSync(path.join(links, 'docs/map/memo'), { recursive: true });
fs.writeFileSync(path.join(links, 'docs/map/memo', 'link-triage.md'), `# 关联噪音审阅\n\n- features → extras — 噪音：示例引用，非真实依赖（2026-09-02）\n`);
r = run([path.join(SKILL, 'check.mjs'), links]);
check('triage 登记后该边豁免', r.status === 0 && !/features → extras/.test(r.out), r.out.slice(-600));

// strictLinks 门禁（G4/P2）：缺标记 = 漂移
const cfgFile = path.join(links, 'docs/map/governance.json');
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
cfg.strictLinks = true; fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
fs.writeFileSync(path.join(links, 'ui', 'view.js'), "export const View = (v) => v;\n// touch\n");
r = run([path.join(SKILL, 'check.mjs'), links]);
check('strictLinks：双向往标记齐全 → exit0', r.status === 0, r.out.slice(-600));
// 破坏一个标记 → 拦截（整行移除，杜绝残留匹配）
fs.writeFileSync(path.join(links, 'docs/map/root/features.md'), fs.readFileSync(path.join(links, 'docs/map/root/features.md'), 'utf8').replace('- `ui` — 关联（改features需检查ui）\n', ''));
r = run([path.join(SKILL, 'check.mjs'), links]);
check('strictLinks：缺标记 → exit1', r.status === 1 && /⛔ strictLinks/.test(r.out), r.out.slice(-600));

// G6：links 未开启且残留 .internal → 不提示
const noLink = path.join(BASE, 'nolink');
for (const d of ['a', 'b']) fs.mkdirSync(path.join(noLink, d), { recursive: true });
fs.writeFileSync(path.join(noLink, 'a', 'x.js'), "import { b } from 'b/y.js';\nexport const x = 1;\n");
fs.writeFileSync(path.join(noLink, 'b', 'y.js'), 'export const b = 1;\n');
run([path.join(SKILL, 'init.mjs'), noLink]); // 不开 links
run([path.join(SKILL, 'sync.mjs'), noLink, '--links']); // 手动预览留下 .internal
r = run([path.join(SKILL, 'check.mjs'), noLink]);
check('G6：links 未开启 → 无关联提示', !/🔗/.test(r.out) && r.status === 0, r.out.slice(-600));

// ============ T5 规模审查提示 ============
console.log('\n[T5] 规模审查');
const bigmod = path.join(BASE, 'bigmod');
fs.mkdirSync(path.join(bigmod, 'src'), { recursive: true });
for (let i = 0; i < 250; i++) fs.writeFileSync(path.join(bigmod, 'src', `f${String(i).padStart(4, '0')}.js`), 'export const x=1;\n');
r = run([path.join(SKILL, 'init.mjs'), bigmod, '--level', 'files']);
check('--level files 显式生效', /粒度: files（显式）/.test(r.out), r.out.slice(-300));
r = run([path.join(SKILL, 'check.mjs'), bigmod]);
check('📏 规模提示出现且不拦截', r.status === 0 && /📏/.test(r.out), r.out.slice(-500));

// T5b: 阈值可配置（config.hints.maxDocLines）
const smallish = path.join(BASE, 'smallish');
fs.mkdirSync(path.join(smallish, 'src'), { recursive: true });
for (let i = 0; i < 60; i++) fs.writeFileSync(path.join(smallish, 'src', `f${String(i).padStart(3, '0')}.js`), 'export const x=1;\n');
run([path.join(SKILL, 'init.mjs'), smallish]);
r = run([path.join(SKILL, 'check.mjs'), smallish]);
check('T5b 默认阈值(200)：无规模提示', !/📏/.test(r.out), r.out.slice(-400));
fs.writeFileSync(path.join(smallish, 'docs/map/governance.json'), JSON.stringify({ level: 'files', hints: { maxDocLines: 50 } }, null, 2));
r = run([path.join(SKILL, 'check.mjs'), smallish]);
check('T5b 配置阈值(50)：提示出现', /📏/.test(r.out), r.out.slice(-400));

// ============ T6 devref 端到端 ============
console.log('\n[T6] devref');
const ref = path.join(BASE, 'ref');
fs.mkdirSync(path.join(ref, 'src'), { recursive: true });
fs.writeFileSync(path.join(ref, 'src', 'a.js'), 'export const a=1;\n');
run([path.join(SKILL, 'init.mjs'), ref]);
// 服务起在独立子进程（spawnSync 会冻结父进程事件循环，内嵌服务器会死锁 fetch）
const portFile = path.join(BASE, 'port.txt');
const serverCode = [
  "const http=require('http');const fs=require('fs');",
  "const srv=http.createServer((q,r)=>{r.setHeader('Content-Type','text/plain');r.end('# Dev Ref\\n\\nHello world docs.\\n');});",
  "srv.listen(0,'127.0.0.1',()=>{fs.writeFileSync(process.argv[2], String(srv.address().port));});",
  "process.on('SIGTERM',()=>process.exit(0));",
].join('');
const serverChild = spawn(process.execPath, ['-e', serverCode, 'x', portFile], { stdio: 'ignore' });
let port = null;
const t0 = Date.now();
while (!port && Date.now() - t0 < 8000) {
  try { port = fs.readFileSync(portFile, 'utf8').trim(); } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
check('测试服务器就绪', !!port, 'port: ' + port);
const manifest = { dir: 'docs/devref', docs: [{ name: 'dev-guide.md', url: `http://127.0.0.1:${port}/dev-guide.md`, note: '开发指南' }] };
const manFile = path.join(BASE, 'manifest.json');
fs.writeFileSync(manFile, JSON.stringify(manifest, null, 2));
r = run([path.join(SKILL, 'devref.mjs'), ref, manFile]);
serverChild.kill();
check('devref 拉取 exit0', r.status === 0, r.out.slice(-600));
check('devref 落盘', fs.existsSync(path.join(ref, 'docs/devref/dev-guide.md')));
const idx = fs.readFileSync(path.join(ref, 'docs/map/index.md'), 'utf8');
check('devref 登记进 index Optional', idx.includes('## Optional') && idx.includes('dev-guide.md'), idx.slice(-400));
check('devref 登记 files.md（自建）', fs.existsSync(path.join(ref, 'docs/map/tree/files.md')));
check('devref gitignore', fs.readFileSync(path.join(ref, '.gitignore'), 'utf8').includes('docs/devref'));
r = run([path.join(SKILL, 'check.mjs'), ref]);
check('devref 后 check exit0', r.status === 0, r.out.slice(-400));

// ============ T7 白名单 roots ============
console.log('\n[T7] roots 白名单');
const wl = path.join(BASE, 'wl');
for (const d of ['src', 'vendor', 'extra']) fs.mkdirSync(path.join(wl, d), { recursive: true });
fs.writeFileSync(path.join(wl, 'src', 'a.js'), 'export const a=1;\n');
fs.writeFileSync(path.join(wl, 'vendor', 'b.js'), 'export const b=1;\n');
fs.writeFileSync(path.join(wl, 'extra', 'c.js'), 'export const c=1;\n');
r = run([path.join(SKILL, 'init.mjs'), wl, '--root', 'src,vendor']);
check('init --root 生效', /识别模块 2 个: src, vendor/.test(r.out), r.out.slice(-300));
check('roots 持久化进配置', JSON.parse(fs.readFileSync(path.join(wl, 'docs/map/governance.json'), 'utf8')).roots.join(',') === 'src,vendor');
check('extra 不入 tree', !fs.existsSync(path.join(wl, 'docs/map/tree/extra.md')));
r = run([path.join(SKILL, 'sync.mjs'), wl]);
check('sync 遵守白名单', !fs.existsSync(path.join(wl, 'docs/map/tree/extra.md')), r.out.slice(-300));
r = run([path.join(SKILL, 'check.mjs'), wl]);
check('check 白名单内一致 exit0', r.status === 0, r.out.slice(-300));

// ============ T15 ADR 捕获 ============
console.log('\n[T15] ADR 捕获');
const adr = path.join(BASE, 'adr');
fs.mkdirSync(path.join(adr, 'src'), { recursive: true });
fs.writeFileSync(path.join(adr, 'src', 'a.js'), 'export const a=1;\n');
run([path.join(SKILL, 'init.mjs'), adr]);
check('init 生成 decisions 骨架', fs.existsSync(path.join(adr, 'docs/map/decisions/README.md')) && fs.existsSync(path.join(adr, 'docs/map/decisions/_template.md')));
r = run([path.join(SKILL, 'adr.mjs'), adr, '改用 pnpm']);
check('adr 创建 ADR-0001', r.status === 0 && fs.existsSync(path.join(adr, 'docs/map/decisions/ADR-0001.md')), r.out);
check('adr 登记 README 索引', /ADR-0001/.test(fs.readFileSync(path.join(adr, 'docs/map/decisions/README.md'), 'utf8')));
r = run([path.join(SKILL, 'adr.mjs'), adr, '第二条决策', '--status', 'accepted']);
check('adr 递增编号', fs.existsSync(path.join(adr, 'docs/map/decisions/ADR-0002.md')));

// ============ T16 root.md 派生汇总 + 一致性 ============
console.log('\n[T16] root.md 派生汇总');
const rm = path.join(BASE, 'rm');
for (const d of ['a', 'b']) fs.mkdirSync(path.join(rm, d), { recursive: true });
fs.writeFileSync(path.join(rm, 'a', 'x.js'), "import { y } from 'b/y.js';\nexport const x=1;\n");
fs.writeFileSync(path.join(rm, 'b', 'y.js'), 'export const y=1;\n');
run([path.join(SKILL, 'init.mjs'), rm, '--links']);
// 填 root/a.md 职责/负责/相关模块
const ra = path.join(rm, 'docs/map/root/a.md');
fs.writeFileSync(ra, fs.readFileSync(ra, 'utf8')
  .replace('- **职责**：（待填）', '- **职责**：业务编排')
  .replace('- **负责**：（待填）', '- **负责**：@alice')
  .replace('- （待填）`<模块或文件路径>` — 与<本模块>的关系', '- `b` — 依赖其服务（双向）'));
run([path.join(SKILL, 'sync.mjs'), rm]);
const rmTable = fs.readFileSync(path.join(rm, 'docs/map/root.md'), 'utf8');
check('root.md 表汇总职责/负责', /业务编排/.test(rmTable) && /@alice/.test(rmTable), rmTable);
check('root.md 表汇总关联 b', /`b`/.test(rmTable.split('MODULE_TABLE_BEGIN')[1] || ''), rmTable);
r = run([path.join(SKILL, 'check.mjs'), rm]);
check('root 一致性 check 通过(links 双向标记齐)', r.status === 0 && !/root\.md 表/.test(r.out), r.out.slice(-500));
// 手工破坏派生表 → 一致性提示
fs.writeFileSync(path.join(rm, 'docs/map/root.md'), fs.readFileSync(path.join(rm, 'docs/map/root.md'), 'utf8').replace('| `a` | 业务编排 |', '| `a` | ××× |'));
r = run([path.join(SKILL, 'check.mjs'), rm]);
check('root.md 表漂移提示', /root\.md 表/.test(r.out), r.out.slice(-500));

// ============ T17 index reconcile ============
console.log('\n[T17] index reconcile');
const ir = path.join(BASE, 'ir');
fs.mkdirSync(path.join(ir, 'src'), { recursive: true });
fs.writeFileSync(path.join(ir, 'src', 'a.js'), 'export const a=1;\n');
run([path.join(SKILL, 'init.mjs'), ir]);
fs.mkdirSync(path.join(ir, 'newmod'), { recursive: true });
fs.writeFileSync(path.join(ir, 'newmod', 'n.js'), 'export const n=1;\n');
r = run([path.join(SKILL, 'check.mjs'), ir]);
check('index 缺模块提示', /index\.md 缺模块：newmod/.test(r.out), r.out.slice(-400));
r = run([path.join(SKILL, 'sync.mjs'), ir, '--reindex']);
check('--reindex 刷新导航', /index\.md 导航已与模块对齐/.test(r.out), r.out.slice(-400));
r = run([path.join(SKILL, 'check.mjs'), ir]);
check('reindex 后 index 一致', !/index\.md 缺模块/.test(r.out), r.out.slice(-400));

// ============ T18 语义完整性 ============
console.log('\n[T18] 语义完整性');
const se = path.join(BASE, 'se');
fs.mkdirSync(path.join(se, 'src'), { recursive: true });
fs.writeFileSync(path.join(se, 'src', 'a.js'), 'export const a=1;\n');
run([path.join(SKILL, 'init.mjs'), se]);
r = run([path.join(SKILL, 'check.mjs'), se]);
check('默认：职责待填进提示', /📚 .*职责=（待填）/.test(r.out), r.out.slice(-400));
const seCfg = path.join(se, 'docs/map/governance.json');
const sc = JSON.parse(fs.readFileSync(seCfg, 'utf8')); sc.strictSemantics = true; fs.writeFileSync(seCfg, JSON.stringify(sc, null, 2));
r = run([path.join(SKILL, 'check.mjs'), se]);
check('strictSemantics：拦截 exit1', r.status === 1 && /⛔ strictSemantics/.test(r.out), r.out.slice(-400));

// ============ T19 changelog 门禁（git + tag） ============
console.log('\n[T19] changelog 门禁');
const cl = path.join(BASE, 'cl');
fs.mkdirSync(path.join(cl, 'src'), { recursive: true });
fs.writeFileSync(path.join(cl, 'src', 'a.js'), 'export const a=1;\n');
run([path.join(SKILL, 'init.mjs'), cl, '--changelog']);
check('init --changelog 写入 rules.changelog=error', JSON.parse(fs.readFileSync(path.join(cl, 'docs/map/governance.json'), 'utf8')).rules.changelog === 'error');
const ctx = spawnSync('git', ['init', '-q'], { cwd: cl });
spawnSync('git', ['config', 'user.email', 't@t'], { cwd: cl });
spawnSync('git', ['config', 'user.name', 't'], { cwd: cl });
spawnSync('git', ['add', '-A'], { cwd: cl });
spawnSync('git', ['commit', '-q', '-m', 'init'], { cwd: cl });
spawnSync('git', ['tag', 'v1.0.0'], { cwd: cl });
// 新功能文件 + CHANGELOG Unreleased 仍占位
fs.writeFileSync(path.join(cl, 'src', 'feat.js'), 'export const feat=1;\n');
spawnSync('git', ['add', '-A'], { cwd: cl });
spawnSync('git', ['commit', '-q', '-m', 'feat: add feat'], { cwd: cl });
r = run([path.join(SKILL, 'check.mjs'), cl]);
check('changelog required：有提交无实质条目 → exit1', r.status === 1 && /⛔ changelog/.test(r.out), r.out.slice(-400));
// 补 Unreleased 条目
fs.writeFileSync(path.join(cl, 'CHANGELOG.md'), fs.readFileSync(path.join(cl, 'CHANGELOG.md'), 'utf8').replace('### Added\n- 无', '### Added\n- 新增 feat 功能'));
r = run([path.join(SKILL, 'check.mjs'), cl]);
check('补条目后 changelog 过', r.status === 0 && !/⛔ changelog/.test(r.out), r.out.slice(-400));

// ============ T20 文档卫生 ============
console.log('\n[T20] 文档卫生');
const hy = path.join(BASE, 'hy');
fs.mkdirSync(path.join(hy, 'src'), { recursive: true });
fs.writeFileSync(path.join(hy, 'src', 'a.js'), 'export const a=1;\n');
run([path.join(SKILL, 'init.mjs'), hy]);
fs.mkdirSync(path.join(hy, 'docs/map/memo'), { recursive: true });
fs.writeFileSync(path.join(hy, 'docs/map/memo/note.md'), '这里说我们用了 Postgres，但后来 reversed 到 DynamoDB。\n');
r = run([path.join(SKILL, 'check.mjs'), hy]);
check('文档疤痕提示', /🧹 .*note\.md/.test(r.out), r.out.slice(-400));
fs.writeFileSync(path.join(hy, 'docs/map/memo/note.md'), '<!-- hygiene: ignore -->\n这里说 Postgres，后来 reversed。\n');
r = run([path.join(SKILL, 'check.mjs'), hy]);
check('豁免标记后不提示', !/🧹/.test(r.out), r.out.slice(-400));

// ============ T21 v3：配置迁移 + --json + reconcile ============
console.log('\n[T21] v3 规则引擎');
const v3 = path.join(BASE, 'v3');
fs.mkdirSync(path.join(v3, 'src'), { recursive: true });
fs.writeFileSync(path.join(v3, 'src', 'a.js'), 'export const a=1;\n');
// 模拟 v2.x legacy 配置（无 configVersion）
fs.mkdirSync(path.join(v3, 'docs/map/root'), { recursive: true });
fs.mkdirSync(path.join(v3, 'docs/map/tree'), { recursive: true });
fs.writeFileSync(path.join(v3, 'docs/map/governance.json'), JSON.stringify({ generatedBy: 'v2', level: 'files', strict: true, strictLinks: true, changelog: 'required', strictSemantics: true }, null, 2));
run([path.join(SKILL, 'init.mjs'), v3, '--force']); // 重建地图但保留 legacy 配置语义
fs.writeFileSync(path.join(v3, 'docs/map/governance.json'), JSON.stringify({ generatedBy: 'v2', level: 'files', strict: true, strictLinks: true, changelog: 'required', strictSemantics: true }, null, 2));
r = run([path.join(SKILL, 'check.mjs'), v3]);
const migCfg = JSON.parse(fs.readFileSync(path.join(v3, 'docs/map/governance.json'), 'utf8'));
check('v3 迁移：configVersion=3', migCfg.configVersion === 3, JSON.stringify(migCfg));
check('v3 迁移：legacy→rules 映射', migCfg.rules['untracked-strict'] === 'error' && migCfg.rules.relatedness === 'error' && migCfg.rules.changelog === 'error' && migCfg.rules.semantics === 'error', JSON.stringify(migCfg.rules));
check('v3 迁移：legacy 键已移除', !('strict' in migCfg) && !('strictLinks' in migCfg) && !('changelog' in migCfg), JSON.stringify(migCfg));

// --json 输出（stdout 首行可能是 harness 的 inspector 噪音，取首个 '{' 起）
const parseJson = (out) => { try { return JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)); } catch { return null; } };
r = run([path.join(SKILL, 'check.mjs'), v3, '--json']);
const j = parseJson(r.out);
check('--json 可解析且结构完整', j && typeof j.ok === 'boolean' && Array.isArray(j.errors) && Array.isArray(j.warns), r.out.slice(0, 300));
check('--json 语义门禁为 error（strictSemantics 迁移）', j && j.errors.some((e) => e.rule === 'semantics'), r.out.slice(0, 300));
// 干净项目 --json ok
const v3clean = path.join(BASE, 'v3clean');
fs.mkdirSync(path.join(v3clean, 'src'), { recursive: true });
fs.writeFileSync(path.join(v3clean, 'src', 'a.js'), 'export const a=1;\n');
run([path.join(SKILL, 'init.mjs'), v3clean, '--strict-semantics', '--changelog']);
fs.writeFileSync(path.join(v3clean, 'docs/map/root/src.md'), fs.readFileSync(path.join(v3clean, 'docs/map/root/src.md'), 'utf8').replace('- **职责**：（待填）', '- **职责**：核心逻辑').replace('- **负责**：（待填）', '- **负责**：@me').replace('- **改动影响**：（待填）', '- **改动影响**：全站'));
run([path.join(SKILL, 'sync.mjs'), v3clean]);
r = run([path.join(SKILL, 'check.mjs'), v3clean, '--json']);
const j2 = parseJson(r.out);
check('--json 干净项目 ok=true 且无 error', j2.ok === true && !j2.errors.length, r.out.slice(0, 400));

// reconcile
r = run([path.join(SKILL, 'reconcile.mjs'), v3clean]);
check('reconcile 无目标时 ok', r.status === 0 && /无 reconcile 目标/.test(r.out), r.out.slice(-300));
fs.writeFileSync(path.join(v3clean, 'docs/map/memo_note.md'), '我们用 Postgres，后 reversed 到 DynamoDB。\n');
fs.mkdirSync(path.join(v3clean, 'docs/map/memo'), { recursive: true });
fs.renameSync(path.join(v3clean, 'docs/map/memo_note.md'), path.join(v3clean, 'docs/map/memo/note.md'));
r = run([path.join(SKILL, 'check.mjs'), v3clean, '--json']);
const j3 = parseJson(r.out);
check('卫生疤痕进 --json warns', j3 && j3.warns.some((w) => w.rule === 'doc-hygiene'), r.out.slice(0, 400));
r = run([path.join(SKILL, 'reconcile.mjs'), v3clean]);
check('reconcile 列疤痕目标', /note\.md/.test(r.out), r.out.slice(-400));
r = run([path.join(SKILL, 'reconcile.mjs'), v3clean, '--done']);
check('reconcile --done 落时间戳', fs.existsSync(path.join(v3clean, '.internal/reconcile-last.txt')), r.out.slice(-300));

console.log(`\n==== 冒烟结果: ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail ? 1 : 0);