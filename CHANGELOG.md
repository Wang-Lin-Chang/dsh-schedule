# Changelog

## [0.1.0] - 2026-08-16

### Added

- Plugin shell over schedule-core: executor bridge (jobs/agents), dual remind/job actions.
- Three platform job runners vendored: Windows ACL / Linux chattr+bwrap / macOS uchg+sandbox-exec.
- `schedule_create` / `schedule_list` / `schedule_delete` tools (upstream-compatible names, extended `action`/`job_spec`).
- Shell integration test (9 assertions): real detached spawn + exit protocol + remind live/ghost + DST rejection.

### Fixed

- Job output directory creation (mkdtemp parent) — missing mkdir was swallowed as a silent retry.
