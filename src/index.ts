/**
 * @dsh-external/project-map-governance — 项目治理工具包（toolkit）
 * 引擎 = scripts/*.mjs（skill 目录，pre-commit hook / 其他 agent 亦用同一套）
 * 契约 = 本插件把 init/sync/check/adr/status/reconcile 注册为 DSH 原生工具
 * 规范：资源注册挂 ctx.effect（热重载/卸载自动清理）
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import type { Context } from 'cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from 'schemastery'

export const name = '@dsh-external/project-map-governance'
export const inject = ['tools']

export interface Config {
  scriptsDir: string
  nodeBin: string
}

export const Config = z.object({
  scriptsDir: z.string().default('C:/Users/lk/.dsh/skills/project-map-governance/scripts'),
  nodeBin: z.string().default('node'),
})

interface RunResult { status: number | null; out: string; err: string }

function run(cfg: Config, tool: string, args: string[]): RunResult {
  const res = spawnSync(cfg.nodeBin, [path.join(cfg.scriptsDir, `${tool}.mjs`), ...args], {
    encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
  })
  return { status: res.status === undefined ? null : res.status, out: res.stdout || '', err: res.stderr || '' }
}

const text = (r: RunResult) => (r.out + (r.err ? '\n[stderr] ' + r.err.trim() : '')).trim()

export function apply(ctx: Context, config: Config): void {
  const T = (name_: string, description: string, parameters: Record<string, any>, execute: (args: any) => any) =>
    defineTool({ name: name_, description, parameters, output: { schema: { type: 'string' }, render: (_a: unknown, v: unknown) => [{ type: 'text', text: String(v) }] }, execute })

  ctx.effect(() => ctx.tools.register(T(
    '_dsh_external_project_map_governance_init',
    '初始化项目地图+更新日志治理（AGENTS/CLAUDE + docs/map + CHANGELOG + pre-commit）',
    {
      target: { type: 'string', required: true, description: '项目目录' },
      root: { type: 'string', description: '白名单模块，逗号分隔' },
      level: { type: 'string', description: 'files|dirs|modules' },
      links: { type: 'boolean', description: '开关联探测' },
      strictLinks: { type: 'boolean', description: '关联缺标记=门禁' },
      changelog: { type: 'boolean', description: 'CHANGELOG 门禁' },
      strictSemantics: { type: 'boolean', description: '语义字段待填=门禁' },
      force: { type: 'boolean', description: '覆盖已有精装地图' },
      noHook: { type: 'boolean' },
    },
    (a: any) => {
      const args: string[] = []
      if (a.root) { args.push('--root'); args.push(a.root.split(',').map((s: string) => s.trim()).filter(Boolean).join(',')) }
      if (a.level) { args.push('--level'); args.push(a.level) }
      if (a.links) args.push('--links')
      if (a.strictLinks) args.push('--strict-links')
      if (a.changelog) args.push('--changelog')
      if (a.strictSemantics) args.push('--strict-semantics')
      if (a.force) args.push('--force')
      if (a.noHook) args.push('--no-hook')
      return text(run(config, 'init', [a.target, ...args]))
    },
  )), 'project-map-governance: init')

  ctx.effect(() => ctx.tools.register(T(
    '_dsh_external_project_map_governance_sync',
    '改动后同步地图：tree 按粒度刷新 + root.md 派生表 + index reconcile',
    {
      target: { type: 'string', required: true, description: '项目目录' },
      links: { type: 'boolean', description: '探测跨模块引用候选' },
      list: { type: 'string', description: '打印指定模块全量清单（不落盘）' },
      reindex: { type: 'boolean', description: '对齐 index.md 导航与真实模块' },
    },
    (a: any) => {
      const args: string[] = []
      if (a.links) args.push('--links')
      if (a.list) { args.push('--list'); args.push(a.list) }
      if (a.reindex) args.push('--reindex')
      return text(run(config, 'sync', [a.target, ...args]))
    },
  )), 'project-map-governance: sync')

  ctx.effect(() => ctx.tools.register(defineTool({
    name: '_dsh_external_project_map_governance_check',
    description: '校验地图漂移+规则审查（规则表/severity/--json 返回）',
    parameters: {
      target: { type: 'string', required: true, description: '项目目录' },
      strict: { type: 'boolean', description: '未登记新文件=门禁' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          level: { type: 'string' },
          moduleCount: { type: 'number' },
          ruleErrors: { type: 'number' },
          ruleWarns: { type: 'number' },
          errorRules: { type: 'string' },
          detail: { type: 'string' },
        },
      },
      render: (_a: unknown, v: any) => [{ type: 'text', text: v.detail || JSON.stringify(v) }],
    },
    async execute(args: any) {
      const cli = [args.target, '--json']; if (args.strict) cli.push('--strict')
      const r = run(config, 'check', cli)
      let j: any = null
      try {
        const s = r.out
        const a = s.indexOf('{'); const b = s.lastIndexOf('}')
        j = a >= 0 && b > a ? JSON.parse(s.slice(a, b + 1)) : null
      } catch { j = null }
      const ok = j ? j.ok : r.status !== 1
      const errRules = j ? j.errors.map((e: any) => `${e.rule}(${e.problems.length})`).join(',') : ''
      const detail = [
        ok ? '✅ 地图一致' : '⛔ 有 error 级规则失败',
        j ? `规则结果 error=${j.errors.length} warn=${j.warns.length}` : '',
        errRules ? `失败规则: ${errRules}` : '',
        j ? [...j.errors, ...j.warns].map((e: any) => `[${e.rule}] ${e.problems.join('; ')}`).join('\n') : text(r),
      ].filter(Boolean).join('\n')
      return { ok, level: j?.level || '', moduleCount: j?.dirs?.length || 0, ruleErrors: j?.errors?.length || 0, ruleWarns: j?.warns?.length || 0, errorRules: errRules, detail }
    },
  })), 'project-map-governance: check')

  ctx.effect(() => ctx.tools.register(T(
    '_dsh_external_project_map_governance_adr',
    '新建架构决策记录 ADR-NNNN.md（重大架构/技术决策必须落盘）',
    {
      target: { type: 'string', required: true, description: '项目目录' },
      title: { type: 'string', required: true, description: '决策标题' },
      status: { type: 'string', description: 'proposed|accepted' },
    },
    (a: any) => {
      const args = [a.target, a.title]
      if (a.status) { args.push('--status'); args.push(a.status) }
      return text(run(config, 'adr', args))
    },
  )), 'project-map-governance: adr')

  ctx.effect(() => ctx.tools.register(defineTool({
    name: '_dsh_external_project_map_governance_status',
    description: '治理状态快照：配置/粒度/模块/ADR/reconcile 天数',
    parameters: { target: { type: 'string', required: true, description: '项目目录' } },
    output: {
      schema: { type: 'string' },
      render: (_a: unknown, v: unknown) => [{ type: 'text', text: String(v) }],
    },
    async execute(a: any) { return text(run(config, 'status', [a.target])) },
  })), 'project-map-governance: status')

  ctx.effect(() => ctx.tools.register(T(
    '_dsh_external_project_map_governance_reconcile',
    '文档卫生 reconcile：列出需要重读核对的治理文档（疤痕/改动/超期）',
    {
      target: { type: 'string', required: true, description: '项目目录' },
      days: { type: 'number', description: '超期阈值（默认 30）' },
      done: { type: 'boolean', description: '记录本次 reconcile 时间戳' },
    },
    (a: any) => {
      const args = [a.target]
      if (a.days) { args.push('--days'); args.push(String(a.days)) }
      if (a.done) args.push('--done')
      return text(run(config, 'reconcile', args))
    },
  )), 'project-map-governance: reconcile')
}
