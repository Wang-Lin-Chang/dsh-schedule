// dsh-schedule/src/schedule-tools.ts —— 调度三工具（协议对齐官方名字，扩展 action/job_spec）
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { parseAbsolute } from '../vendor/lib/time.js'
import type { ScheduleRegistry, ScheduleInput } from '../vendor/lib/ScheduleRegistry.js'

export const name = 'dsh-schedule-tools'
export const inject = ['tools', 'schedule'] as const

export function apply(ctx: Context) {
  const sch = ctx.get('schedule') as unknown as ScheduleRegistry
  const tools = ctx.get('tools') as unknown as { register: (tool: unknown) => void }

  tools.register(defineTool({
    name: 'schedule_create',
    description: '创建持久调度：after_seconds / at / every_seconds 三选一；action=remind（默认，到点提醒）或 job（到点执行命令并落任务档案）。调度状态存 SQLite，跨会话跨重启有效。',
    parameters: {
      prompt: { type: 'string', required: true, description: '提醒文本或任务描述' },
      after_seconds: { type: 'number', description: 'N 秒后触发（正整数）' },
      at: { type: 'string', description: '绝对时刻：RFC3339 带偏移 或 "YYYY-MM-DDTHH:mm:ss"（配合 time_zone）' },
      every_seconds: { type: 'number', description: '固定间隔（≥300 秒）' },
      action: { type: 'string', description: 'remind（默认）| job' },
      job_spec: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', description: '任务 kind（如 pwsh）' },
          command: { type: 'string', description: '要执行的命令' },
          label: { type: 'string', description: '任务标签' },
        },
      },
      time_zone: { type: 'string', description: 'IANA 时区（配合无偏移的 at）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          scheduled_at: { type: 'number' },
        },
      },
      render: (_a: unknown, v: any) => [{ type: 'text', text: JSON.stringify(v) }],
    },
    async execute(args) {
      const a = args as any
      const selectors = [a.after_seconds, a.at, a.every_seconds].filter(x => x !== undefined)
      if (selectors.length !== 1) throw new Error('invalid_rule: exactly one of after_seconds/at/every_seconds required')
      const action = (a.action ?? 'remind') === 'job' ? 'job' : 'remind'
      let input: ScheduleInput = { prompt: String(a.prompt ?? ''), rule: 'after', action, createdBy: undefined }
      if (a.after_seconds !== undefined) {
        if (!Number.isSafeInteger(a.after_seconds) || a.after_seconds <= 0) throw new Error('invalid_rule: after_seconds must be a positive integer')
        input = { ...input, rule: 'after', afterSeconds: a.after_seconds }
      } else if (a.every_seconds !== undefined) {
        if (!Number.isSafeInteger(a.every_seconds) || a.every_seconds <= 0) throw new Error('invalid_rule: every_seconds must be a positive integer')
        input = { ...input, rule: 'every', everySeconds: a.every_seconds }
      } else {
        const at = a.at
        if (typeof at !== 'string') throw new Error('invalid_selector')
        input = { ...input, rule: 'at', atEpochMs: parseAbsolute(at, typeof a.time_zone === 'string' ? a.time_zone : undefined) }
      }
      if (action === 'job') {
        const js = a.job_spec as any
        if (js === undefined || typeof js.command !== 'string' || js.command.length === 0) throw new Error('invalid_rule: action=job requires job_spec.command')
        input = { ...input, action, jobSpec: { kind: String(js.kind ?? 'pwsh'), command: js.command, label: typeof js.label === 'string' ? js.label : String(a.prompt) } }
      }
      const rec = sch.create(input)
      return { id: rec.id, status: rec.status, scheduled_at: rec.scheduledAt }
    },
  }))

  tools.register(defineTool({
    name: 'schedule_list',
    description: '列出活动调度（按创建顺序，含状态与下次触发时刻）。',
    parameters: {},
    output: {
      schema: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, status: { type: 'string' }, scheduled_at: { type: 'number' }, prompt: { type: 'string' }, action: { type: 'string' } } } },
      render: (_a: unknown, v: any[]) => [{ type: 'text', text: v.length === 0 ? '(no schedules)' : v.map(s => `${s.id} [${s.action}] ${s.status} @ ${new Date(s.scheduled_at).toISOString()} — ${s.prompt.slice(0, 60)}`).join('\n') }],
    },
    async execute() {
      return sch.list().map(s => ({ id: s.id, status: s.status, scheduled_at: s.scheduledAt, prompt: s.prompt, action: s.action }))
    },
  }))

  tools.register(defineTool({
    name: 'schedule_delete',
    description: '删除活动调度（未知或已终结 id 返回 deleted:false + schedule_not_found）。',
    parameters: {
      id: { type: 'string', required: true, description: '调度 id' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, deleted: { type: 'boolean' }, code: { type: 'string' } } },
      render: (_a: unknown, v: any) => [{ type: 'text', text: JSON.stringify(v) }],
    },
    async execute(args) {
      return sch.delete(String(args.id ?? ''))
    },
  }))
}
