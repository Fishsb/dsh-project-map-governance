#!/usr/bin/env node
// project-map-governance · lib-links.mjs（公共扫描器，v2.1）
// 跨模块引用探测（sync --links 与 check 自扫描共用）：
//   - 支持绝对风格 'ui/x'、点风格 'lib.api'、<src/x.h>、Python from/import
//   - 支持相对导入 './x'、'../ui/x'、'.ui'（按引用文件目录 resolve 到项目根，取首段）
//   - 只产出"引用方模块 → 被引用模块"的边与次数；同一模块内部引用不计
// 用法: import { findCrossModuleLinks } from './lib-links.mjs'
import fs from 'node:fs';
import path from 'node:path';

export function moduleOfFile(fileRel) {
  // 治理范围内文件 rel 的第一个路径段即模块名
  return fileRel.split(/[/\\]/)[0];
}

export function findCrossModuleLinks(files, projectDir, opts = {}) {
  // files: 治理范围内文件的仓库根相对路径数组（已过滤 cfg/二进制/忽略）
  // 返回: [{ from, to, refs }] 按 refs 降序
  const maxFiles = opts.maxFiles ?? 4000;
  const maxBytes = opts.maxBytes ?? 262144;
  const maxChars = opts.maxChars ?? 20000;
  const modSet = new Set(files.map(moduleOfFile));
  const edges = new Map(); // `${from} → ${to}` → count

  const refRe = [
    /['"]([^'"\n]+)['"]/g,                    // 字符串字面量：'ui/x' 'lib.api' '../ui/x'
    /<([^>\s]+)>/g,                            // #include <src/x.h>
    /(?:from|import)\s+([A-Za-z_][A-Za-z0-9_.]*)/g, // Python: from lib.api import x
  ];

  const resolveModule = (spec, fileRel) => {
    let seg;
    if (spec.startsWith('.')) {
      // 相对导入：按引用文件目录解析到项目根，取首段
      const dir = path.posix.dirname(fileRel);
      seg = path.posix.normalize(path.posix.join(dir, spec)).split('/')[0];
    } else {
      seg = spec.split(/[/.]/)[0];
    }
    if (!seg || !modSet.has(seg)) return null;
    return seg;
  };

  for (const f of files.slice(0, maxFiles)) {
    const from = moduleOfFile(f);
    if (!modSet.has(from)) continue;
    let content;
    try {
      const st = fs.statSync(path.join(projectDir, f));
      if (st.size > maxBytes) continue;
      content = fs.readFileSync(path.join(projectDir, f), 'utf8').slice(0, maxChars);
    } catch { continue; }
    for (const re of refRe) {
      let m; re.lastIndex = 0;
      while ((m = re.exec(content)) !== null) {
        const spec = m[1];
        if (!spec || spec.includes(' ')) continue;
        const to = resolveModule(spec, f);
        if (!to || to === from) continue;
        const key = `${from} → ${to}`;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
  }

  return [...edges.entries()]
    .map(([k, refs]) => {
      const [from, to] = k.split(' → ');
      return { from, to, refs };
    })
    .sort((a, b) => b.refs - a.refs);
}