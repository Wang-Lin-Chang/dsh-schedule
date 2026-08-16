# dsh-schedule

> **Part of the [DSH plugin suite](https://github.com/Wang-Lin-Chang)** — six Apache-2.0 plugins for DeepSeek Harness. · DSH 插件套件之一：六个 Apache-2.0 插件。

> Persistent scheduler for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): reminders and scheduled jobs that **survive session restarts** — SQLite archive, cross-session lease claiming, dual remind/job actions, full clock discipline. Built on [schedule-core](https://github.com/Wang-Lin-Chang/schedule-core). Every claim carries an experiment number.
>
> 给 DeepSeek Harness 的持久调度：**跨会话跨重启存活**的提醒与定时任务——SQLite 档案馆、跨会话租约认领、remind/job 双模、完整时钟纪律。基于 schedule-core。每个能力声明都带实验编号。

[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![ci](https://github.com/Wang-Lin-Chang/dsh-schedule/actions/workflows/ci.yml/badge.svg)](https://github.com/Wang-Lin-Chang/dsh-schedule/actions/workflows/ci.yml)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-4d6bfe)](https://github.com/topics/dsh-plugin)
[![topic: dsh](https://img.shields.io/badge/topic-dsh-4d6bfe)](https://github.com/topics/dsh)

## 为什么存在 / Why this exists

官方 dsh-schedule 是**会话内**提醒器：状态存在会话事件日志里，会话一死，调度跟着死。本插件把调度状态搬进 SQLite 档案馆：

| 维度 | 官方 dsh-schedule | dsh-schedule |
|---|---|---|
| 状态存放 | 会话事件日志（会话死调度死）| SQLite 档案馆 + append-only 事件日志（跨会话）|
| 到期产物 | [SCHEDULE REMINDER] follow-up | 双模：remind（兼容）/ **job（定时执行命令，落任务档案）** |
| 派发主体 | 唯一 live owner | 多会话租约认领（原子抢占 + 60s 租约过期重认领）|
| 时间纪律 | RFC3339 / IANA / DST | **全盘继承，一字不改** |
| 跨重启 | 无 | 冷启动租约释放 + 到期翻转统一 sweep（EXP-1）|

## 你能得到什么 / What you get

- **跨重启调度**——重启后 dispatcher 自动认领到期记录并派发（真机闭环：离线写入 → 重启 → 自动派发 → 任务归档 completed）。
- **定时任务自动归档**——`action: 'job'` 到点 spawn 可恢复执行任务（detach-runner 托管 + exit 协议 + pid 收养），输出并入 jobs 档案，任何会话可读。
- **定时提醒**——`action: 'remind'` 到点给创建会话发 `[SCHEDULE REMINDER]` follow-up；会话不 live 时保持 overdue 下周期重试（不丢提醒）。
- **多会话安全**——单条条件 UPDATE 的租约抢占，两个会话同时在线也不会双派发（fuzz I5：租约不双持）。
- **三平台 job 执行**——job 的 runner 按平台选：Windows ACL 沙箱版 / Linux chattr+bwrap 版 / macOS uchg+sandbox-exec 版（协议全对齐，见 [dsh-cross-platform](https://github.com/Wang-Lin-Chang/dsh-cross-platform) / [dsh-macos](https://github.com/Wang-Lin-Chang/dsh-macos)）。

## 快速开始 / Quick start

```sh
dsh plugin --profile <name> add "github:Wang-Lin-Chang/dsh-schedule#v0.1.0"
```

工具三件（协议对齐官方名字）：

```
schedule_create { after_seconds | at | every_seconds, prompt, action?, job_spec?, time_zone? }
schedule_list
schedule_delete { id }
```

示例：5 分钟后提醒 / 每天 03:00（IANA 时区）跑备份 / 300 秒周期探测。

## 验收证据 / Acceptance evidence

| 层 | 证据 |
|---|---|
| schedule-core | 单元 37 断言 + 时钟乱序 fuzz 200 种子/0 违反 + 实装×模型差分 644 断言/0 失败（见 core 的 EXPERIMENTS.md）|
| 本壳 | 集成 9 断言（job 桥真实 spawn + exit 协议 + remind live/ghost + 三工具 + DST 拒绝）|
| 真机 | 离线写入 → 重启自动认领派发 → 任务归档 completed（全链路闭环，真机日志）|

## 诚实边界 / Honest boundaries

- **at-least-once**：崩溃窗口可能重复派发（设计声明）。
- **every 只追最新**、**无 Cron/日历规则**、`every_seconds ≥ 300`——官方同款。
- **remind 仍会话本地**（提醒对象是会话）；**job 才是跨会话**。
- job 执行的 runner 沙箱语义见三件套后端各自的诚实边界。
- **离线适用面**：架构上无网络依赖（本地 SQLite 档案馆 + 本地 timer；job 执行是否联网取决于任务本身）；数天级断网长跑未实测，不声称。
- **Windows CI 环境**：GitHub Actions windows runner 以管理员运行，ACL deny 沙箱在管理员下失效——CI 断言 runner 的 fail-closed 协议（EXIT:-998）；沙箱能力验收在非管理员 Windows 实测（dsh-witness 同款披露）。

## 开发 / Development

```sh
npm test   # 壳层集成验收（node --experimental-strip-types）
```

## License

Apache-2.0
