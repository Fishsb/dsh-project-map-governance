#!/usr/bin/env node
// project-map-governance · gen-schema-check.mjs
// 校验 governance.schema.json 的 rules.properties 键与 lib-parse RULE_IDS 一致
// （规则注册单点化守护：加规则后 schema 若漏同步，此处报错）
// 用法: node gen-schema-check.mjs [--fix]   --fix = 按 RULE_DESC 重写 schema rules.properties
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from './lib-parse.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.join(HERE, '..', 'governance.schema.json');
const fix = process.argv.includes('--fix');

const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
const schemaRules = Object.keys(schema.properties.rules.properties || {});
const missing = P.RULE_IDS.filter((id) => !schemaRules.includes(id));
const extra = schemaRules.filter((id) => !P.RULE_IDS.includes(id));

if (fix) {
  // 从 RULE_DESC 重建 rules.properties（保留 severity 枚举：除 dead-links 恒 error 外均 off|warn|error）
  const props = {};
  for (const id of P.RULE_IDS) {
    const sev = id === 'dead-links' ? ['error'] : P.SEVERITIES;
    props[id] = { enum: sev, description: P.RULE_DESC[id] || '' };
  }
  schema.properties.rules.properties = props;
  fs.writeFileSync(SCHEMA, JSON.stringify(schema, null, 2) + '\n', 'utf8');
  console.log(`✅ schema rules 已按 RULE_IDS 重写（${P.RULE_IDS.length} 条）`);
  process.exit(0);
}

if (missing.length || extra.length) {
  console.error(`⛔ schema rules 与 RULE_IDS 不一致: 缺 ${missing.join(',')} / 多余 ${extra.join(',')}`);
  console.error('  修复: node gen-schema-check.mjs --fix');
  process.exit(1);
}
console.log(`✅ schema rules 与 RULE_IDS 一致（${P.RULE_IDS.length} 条）`);
