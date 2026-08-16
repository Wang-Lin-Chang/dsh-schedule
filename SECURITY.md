# Security Policy

## Supported versions

Latest tag only. Early public preview — breaking changes may occur.

## Reporting a vulnerability

Private reporting only: https://github.com/Wang-Lin-Chang/dsh-schedule/security/advisories/new

Include: affected version, reproduction steps, impact.

## Scope

Reportable when an attacker can:

- Dispatch the same schedule twice concurrently (lease protocol violation)
- Trigger a dispatch earlier than its scheduled anchor (clock discipline violation)
- Escape the job runner sandbox to overwrite evidence files in the task directory

## Out of scope

- at-least-once duplicate dispatch across crash windows (documented design contract)
- Capability-based escapes documented in the runner backends (dsh-cross-platform / dsh-macos)
