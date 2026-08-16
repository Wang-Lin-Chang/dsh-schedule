// dsh-schedule/src/plugin.ts —— 调度档案馆插件壳：core 与 dsh 生态的桥
// core（vendor/lib）零框架依赖；本壳提供 executor 桥（jobs/agents）+ 三平台 job host + 三工具注册
import type { Context } from '@deepseek-ai/cordis'
import * as fs from 'node:fs'
import { ScheduleRegistry } from '../vendor/lib/ScheduleRegistry.js'
import type { ScheduleConfig as CoreConfig, ScheduleRecord } from '../vendor/lib/types.js'
import { createJobHost } from './job-host.ts'

export interface SchedulePluginConfig {
  dbPath?: string
  leaseMs?: number
  fallbackPollMs?: number
  /** job action 的可恢复执行临时输出目录（detached stdout 落此，settle 吸尾并入 jobs 档案） */
  outputDir?: string
  /** 时钟注入（测试/差分验证用；默认 Date.now） */
  now?: () => number
}

export function apply(ctx: Context, config: SchedulePluginConfig = {}) {
  const outputDir = config.outputDir ?? './data/scheduled-jobs'
  fs.mkdirSync(outputDir, { recursive: true })   // job host 的 mkdtemp 父目录（漏建 = spawn 静默 retry，集成测试抓出）
  const core: CoreConfig = {
    dbPath: config.dbPath,
    leaseMs: config.leaseMs,
    fallbackPollMs: config.fallbackPollMs,
    now: config.now,
    logger: ctx.logger,
    executor: createJobHost(ctx, outputDir),
  }
  const reg = new ScheduleRegistry(core)
  ctx.provide('schedule', reg)
  ctx.effect(() => () => reg.dispose(), 'schedule-persisted')
  return reg
}

export { ScheduleRegistry }
export type { ScheduleRecord }
