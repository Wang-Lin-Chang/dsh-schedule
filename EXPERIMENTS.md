# dsh-schedule 实验记录

> 核心实验账本见 schedule-core 的 EXPERIMENTS.md（EXP-1~EXP-6）。本文件记录壳层与集成实验。

## EXP-7 壳层集成（executor 桥）

装置：假时钟 + 假 jobs/agents，9 断言。抓到两个壳层缺陷：
1. **mkdtemp 父目录漏建**——job 分支 spawn 前 `fs.mkdtempSync(outputDir)` 在 outputDir 不存在时抛 ENOENT，被吞成静默 retry（任务永不派发且无日志）→ 构造时 `mkdirSync(recursive)` 修复。
2. 壳 TS 源跨文件 import 需 `.ts` 后缀（strip-types 直跑路径；build 时由 rewriteRelativeImportExtensions 改写）。

## EXP-8 三平台 job runner（CI 实测）

job action 的 detach-runner 按平台选择：Windows=ACL 沙箱版、Linux=chattr/bwrap 版、macOS=uchg/sandbox-exec 版。三平台 CI（ubuntu-latest / macos-latest / windows-latest）跑同一集成测试：job 真实 spawn → 输出文件 → exit 协议。
