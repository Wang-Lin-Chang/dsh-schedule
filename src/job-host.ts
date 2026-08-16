// dsh-schedule/src/job-host.ts —— 三平台 job executor：detach-runner 托管 + 任务档案桥
// Windows=ACL 沙箱 runner；Linux=chattr/bwrap 版；macOS=uchg/sandbox-exec 版（三件套后端协议全对齐）
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ActionExecutor, ScheduleRecord } from '../vendor/lib/types.js'
import { spawn, spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface JobsRegistryLike {
  start(spec: {
    kind: unknown
    label: string
    run: () => {
      cancel: () => void
      done: Promise<{ status: 'completed' | 'failed'; exitCode?: number }>
      readOutput: () => string
      pid: number
      pidStartTime?: number
      spawnDir: string
    }
  }): string
}
interface AgentsRegistryLike {
  get(id: string): (Agent & { followup?: (m: unknown) => void }) | undefined
}

const runnerName = () =>
  process.platform === 'win32' ? 'detach-runner.cjs'
    : process.platform === 'darwin' ? 'detach-runner-macos.cjs'
      : 'detach-runner-linux.cjs'

/** 进程启动时间（三平台三证据公式；失败返回 undefined——保守失败语义） */
function procStartTime(pid: number): number | undefined {
  try {
    if (process.platform === 'win32') {
      const r = spawnSync('powershell', ['-NoProfile', '-Command', `[int](Get-Date -Date (Get-Process -Id ${pid}).StartTime.ToUniversalTime() -UFormat %s)`], { timeout: 5000, windowsHide: true })
      const t = Number(r.stdout.toString('utf-8').trim())
      return Number.isFinite(t) && t > 0 ? t : undefined
    }
    if (process.platform === 'linux') {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf-8')
      const after = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
      const starttime = Number(after[19])
      const btime = Number(fs.readFileSync('/proc/stat', 'utf-8').match(/btime (\d+)/)?.[1] ?? 0)
      const t = Math.floor(btime + starttime / 100)
      return Number.isFinite(t) && t > 0 ? t : undefined
    }
    // macOS：ps -o lstart（CI 实测格式，6 捕获组年=m[6]）
    const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
    const r = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { timeout: 8000 })
    const m = /^\w+\s+(\w+)\s+(\d+)\s+(\d+):(\d+):(\d+)\s+(\d+)$/.exec(r.stdout.toString('utf-8').trim())
    if (m === null) return undefined
    const t = Math.floor(new Date(Number(m[6]), MONTHS[m[1]], Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])).getTime() / 1000)
    return Number.isFinite(t) && t > 0 ? t : undefined
  } catch { return undefined }
}

/** executor 桥：job → detach-runner 可恢复执行 + jobs 档案；remind → live agent followup */
export function createJobHost(ctx: Context, outputDir: string): ActionExecutor {
  const agents = () => ctx.get('agents') as unknown as AgentsRegistryLike | undefined

  const executeJob = (rec: ScheduleRecord): 'done' | 'retry' => {
    if (rec.jobSpec === undefined) return 'retry'
    const jobs = ctx.get('jobs') as unknown as JobsRegistryLike | undefined
    if (jobs === undefined) return 'retry'   // 执行器未就绪：保持 overdue 下周期重试
    try {
      // 可恢复执行：detached node 托管（父死子存活的必要条件），stdout → out.log，退出码 → exit.txt
      const runDir = fs.mkdtempSync(path.join(outputDir, 'sched-'))
      const outFile = path.join(runDir, 'out.log')
      const exitFile = path.join(runDir, 'exit.txt')
      const runnerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor', runnerName())
      const cmdB64 = Buffer.from(rec.jobSpec.command, 'utf-8').toString('base64')
      // Linux 用 bwrap 只读视图模式：chattr +i 需要 CAP_LINUX_IMMUTABLE（CI 非 root 施加不了 → fail-closed EXIT:-998）；
      // bwrap 非特权可用（EXP-3 验证），沙箱能力同级（任务目录写全挡）
      const runnerArgs = [runnerPath, runDir, outFile, exitFile, cmdB64]
      if (process.platform === 'linux') runnerArgs.push('bwrap')
      const child = spawn(process.execPath, runnerArgs, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      const pid = child.pid ?? 0
      const startTime = pid > 0 ? procStartTime(pid) : undefined
      const done = new Promise<{ status: 'completed' | 'failed'; exitCode?: number }>(res => {
        child.on('exit', (code) => res({ status: code === 0 ? 'completed' : 'failed', exitCode: code ?? undefined }))
        child.on('error', () => res({ status: 'failed' }))
      })
      let readOffset = 0
      jobs.start({
        kind: rec.jobSpec.kind as never,
        label: rec.jobSpec.label || `[scheduled] ${rec.prompt}`,
        run: () => ({
          cancel: () => { try { child.kill() } catch {} },
          done,
          readOutput: () => {
            try {
              const size = fs.statSync(outFile).size
              if (size <= readOffset) return ''
              const buf = Buffer.allocUnsafe(size - readOffset)
              const rfd = fs.openSync(outFile, 'r')
              try {
                let off = 0
                while (off < buf.length) {
                  const n = fs.readSync(rfd, buf, off, buf.length - off, readOffset + off)
                  if (n <= 0) break
                  off += n
                }
                readOffset += off
                return buf.subarray(0, off).toString('utf-8')
              } finally { fs.closeSync(rfd) }
            } catch { return '' }
          },
          pid,
          pidStartTime: startTime ?? undefined,
          spawnDir: runDir,
        }),
      })
      return 'done'
    } catch (error) {
      ctx.logger?.warn?.(`schedule: job spawn failed for ${rec.id}: ${String(error)}`)
      return 'retry'
    }
  }

  const deliverReminder = (rec: ScheduleRecord): 'done' | 'retry' => {
    const owner = rec.createdBy !== undefined ? agents()?.get(rec.createdBy) : undefined
    if (owner === undefined) return 'retry'   // 会话不 live：保持 overdue（下次周期重试）
    try {
      owner.followup?.({
        content: [{
          type: 'text',
          text: `[SCHEDULE REMINDER]\nschedule_id: ${rec.id}\noccurrence_at: ${new Date(rec.scheduledAt).toISOString()}\nreminder: ${rec.prompt}`,
        }],
        source: { kind: 'plugin', plugin: 'dsh-schedule', form: 'notice', summary: '定时提醒' },
      } as never)
      return 'done'
    } catch { return 'retry' }
  }

  return { executeJob, deliverReminder }
}
