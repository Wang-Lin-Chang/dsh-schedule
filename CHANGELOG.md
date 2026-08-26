# Changelog

## [0.1.1] - 2026-08-26

### Changed

- 语言合规清扫：vendor 注释措辞；README 双语分文件（README.md 英文 + README.zh-CN.md 中文）；CI 三平台矩阵。协议与数字不变。

## [0.1.0] - 2026-08-16

### Added

- Plugin shell over schedule-core: executor bridge (jobs/agents), dual remind/job actions.
- Three platform job runners vendored: Windows ACL / Linux chattr+bwrap / macOS uchg+sandbox-exec.
- `schedule_create` / `schedule_list` / `schedule_delete` tools (upstream-compatible names, extended `action`/`job_spec`).
- Shell integration test (9 assertions): real detached spawn + exit protocol + remind live/ghost + DST rejection.

### Fixed

- Job output directory creation (mkdtemp parent) — missing mkdir was swallowed as a silent retry.
