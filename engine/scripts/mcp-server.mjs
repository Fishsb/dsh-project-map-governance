#!/usr/bin/env node
// project-map-governance · mcp-server.mjs（v3）
// MCP stdio 薄包装：把同套治理脚本暴露为 MCP 工具，供任意支持 MCP 的 agent 使用
// （如 Claude Code：claude mcp add project-map-governance -- node <此处>/mcp-server.mjs）
// 协议：JSON-RPC over stdio（initialize / tools/list / tools/call）
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const NODE = process.execPath;

const S = (description, properties, required = []) => ({
  type: 'object', additionalProperties: false,
  properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, { type: v, description: '' }])),
  ...(required.length ? { required } : {}),
});
const P = (name, description, inputSchema, compose) => ({ name, description, inputSchema, compose });

const TOOLS = [
  P('project-governance.init', '初始化项目地图+更新日志治理（AGENTS/CLAUDE + docs/map + CHANGELOG + pre-commit hook）',
    S('项目路径', { target: 'string', root: 'string', level: 'string', links: 'boolean', strictLinks: 'boolean', changelog: 'boolean', strictSemantics: 'boolean', force: 'boolean' }, ['target']),
    (a) => { const r = [a.target]; if (a.root) { r.push('--root', a.root); } if (a.level) r.push('--level', a.level); ['links', 'strictLinks', 'changelog', 'strictSemantics', 'force'].forEach((k) => { if (a[k]) r.push('--' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())); }); return r; }),
  P('project-governance.sync', '改动后同步地图：tree 刷新 + root.md 派生表 + index reconcile（可 --links / --list / --reindex）',
    S('项目路径', { target: 'string', links: 'boolean', list: 'string', reindex: 'boolean' }, ['target']),
    (a) => { const r = [a.target]; if (a.links) r.push('--links'); if (a.list) r.push('--list', a.list); if (a.reindex) r.push('--reindex'); return r; }),
  P('project-governance.check', '校验地图漂移 + 规则审查（dead-links/relatedness/changelog/semantics/…，severity 由 governance.json 决定）',
    S('项目路径', { target: 'string', strict: 'boolean' }, ['target']),
    (a) => { const r = ['--json', a.target]; if (a.strict) r.push('--strict'); return r; }),
  P('project-governance.adr', '新建架构决策记录 ADR-NNNN.md 并登记索引',
    S('项目路径', { target: 'string', title: 'string', status: 'string' }, ['target', 'title']),
    (a) => { const r = [a.target, a.title]; if (a.status) r.push('--status', a.status); return r; }),
  P('project-governance.status', '治理状态快照（配置/粒度/模块/ADR/reconcile 天数）',
    S('项目路径', { target: 'string' }, ['target']),
    (a) => [a.target]),
  P('project-governance.reconcile', '文档卫生 reconcile：列出需重读核对的治理文档（疤痕/改动/超期）',
    S('项目路径', { target: 'string', days: 'number', done: 'boolean' }, ['target']),
    (a) => { const r = [a.target]; if (a.days) r.push('--days', String(a.days)); if (a.done) r.push('--done'); return r; }),
];

function runTool(toolName, args) {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool) return { error: `unknown tool: ${toolName}` };
  const argv = tool.compose(args || {});
  const res = spawnSync(NODE, [path.join(SCRIPTS, `${toolName.replace('project-governance.', '')}.mjs`), ...argv], {
    encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
  });
  const err = res.stderr || '';
  return { out: res.stdout || '', status: res.status === undefined ? null : res.status, err };
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const send = (payload) => { if (payload && payload.id !== undefined) process.stdout.write(JSON.stringify(payload) + '\n'); };
  try {
    if (msg.method === 'initialize') {
      send({ id: msg.id, result: { protocolVersion: msg.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'project-map-governance', version: '3.0.0' } } });
    } else if (msg.method === 'notifications/initialized') {
      // 无需回复
    } else if (msg.method === 'tools/list') {
      send({ id: msg.id, result: { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) } });
    } else if (msg.method === 'tools/call') {
      const { name, arguments: args } = msg.params || {};
      const r = runTool(name, args);
      if (r.error) { send({ id: msg.id, error: { code: -32602, message: r.error } }); }
      else {
        const text = (r.out + (r.err ? '\n[stderr] ' + r.err.trim() : '')).trim();
        send({ id: msg.id, result: { content: [{ type: 'text', text }], isError: r.status !== 0 } });
      }
    } else {
      send({ id: msg.id, error: { code: -32601, message: `unknown method ${msg.method}` } });
    }
  } catch (e) { send({ id: msg.id, error: { code: -32603, message: String(e && e.message || e) } }); }
});