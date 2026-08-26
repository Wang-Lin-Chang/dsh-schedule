# dsh-schedule

> **Part of the [DSH plugin suite](https://github.com/Wang-Lin-Chang)** — six Apache-2.0 plugins for DeepSeek Harness.

> Persistent scheduler for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): reminders and scheduled jobs that **survive session restarts** — SQLite archive, cross-session lease claiming, dual remind/job actions, full clock discipline. Built on [schedule-core](https://github.com/Wang-Lin-Chang/schedule-core). Every claim carries an experiment number.

中文版见 [README.zh-CN.md](./README.zh-CN.md)。

[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![ci](https://github.com/Wang-Lin-Chang/dsh-schedule/actions/workflows/ci.yml/badge.svg)](https://github.com/Wang-Lin-Chang/dsh-schedule/actions/workflows/ci.yml)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-4d6bfe)](https://github.com/topics/dsh-plugin)
[![topic: dsh](https://img.shields.io/badge/topic-dsh-4d6bfe)](https://github.com/topics/dsh)

## Why this exists

The official dsh-schedule is a **session-local** reminder: state lives in the session event log, so when the session dies, the schedule dies with it. This plugin moves schedule state into a SQLite archive:

| Dimension | Official dsh-schedule | dsh-schedule |
|---|---|---|
| State storage | Session event log (session death = schedule death) | SQLite archive + append-only event log (cross-session) |
| Due products | [SCHEDULE REMINDER] follow-up | Dual-mode: remind (compatible) / **job (timed command execution, archived task records)** |
| Dispatch subject | Single live owner | Multi-session lease claiming (atomic preemption + 60s lease-expiry re-claim) |
| Clock discipline | RFC3339 / IANA / DST | **Fully inherited, unchanged** |
| Across restarts | None | Cold-start lease release + due-flip unified sweep (EXP-1) |

## What you get

- **Scheduling across restarts** — after a restart the dispatcher automatically claims due records and dispatches them (real-machine closed loop: offline write → restart → automatic dispatch → task archived as completed).
- **Automatic task archiving for scheduled jobs** — `action: 'job'` spawns a recoverable task on schedule (detach-runner supervision + exit protocol + pid adoption); output joins the jobs archive, readable from any session.
- **Timed reminders** — `action: 'remind'` sends a `[SCHEDULE REMINDER]` follow-up to the creating session when due; while the session is not live it stays overdue and retries next cycle (no reminder lost).
- **Multi-session safety** — single conditional-UPDATE lease preemption; two sessions online at once cannot double-dispatch (fuzz I5: no double lease).
- **Three-platform job execution** — the job runner is chosen per platform: Windows ACL sandbox / Linux chattr+bwrap / macOS uchg+sandbox-exec (protocols aligned; see [dsh-cross-platform](https://github.com/Wang-Lin-Chang/dsh-cross-platform) / [dsh-macos](https://github.com/Wang-Lin-Chang/dsh-macos)).

## Quick start

```sh
dsh plugin --profile <name> add "github:Wang-Lin-Chang/dsh-schedule#v0.1.0"
```

Three tools (names aligned with the official ones):

```
schedule_create { after_seconds | at | every_seconds, prompt, action?, job_spec?, time_zone? }
schedule_list
schedule_delete { id }
```

Examples: remind in 5 minutes / run a backup daily at 03:00 (IANA time zone) / probe every 300 seconds.

## Acceptance evidence

| Layer | Evidence |
|---|---|
| schedule-core | 37 unit assertions + wall-clock disorder fuzz 200 seeds/0 violations + implementation×model differential 644 assertions/0 failures (see core's EXPERIMENTS.md) |
| This shell | 9 integration assertions (real job-bridge spawn + exit protocol + remind live/ghost + three tools + DST rejection) |
| Real machine | Offline write → restart auto-claim dispatch → task archived as completed (full closed loop, real-machine logs) |

## Honest boundaries

- **at-least-once**: a crash window may double-dispatch (by design).
- **every tracks only the latest**, **no Cron/calendar rules**, `every_seconds ≥ 300` — same as the official one.
- **remind stays session-local** (the reminder target is a session); **job is the cross-session one**.
- Job-runner sandbox semantics live in each backend's own honest-boundaries section.
- **Offline applicability**: architecturally no network dependency (local SQLite archive + local timer; whether job execution needs the network depends on the task itself); multi-day offline runs are not measured, not claimed.
- **Windows CI environment**: the GitHub Actions windows runner runs as administrator, where ACL deny sandboxes do not apply — CI asserts the runner's fail-closed protocol (EXIT:-998); sandbox capabilities are measured on non-admin Windows (same disclosure as dsh-witness).

## Development

```sh
npm test   # shell integration acceptance (node --experimental-strip-types)
```

## License

Apache-2.0
