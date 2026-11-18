# LAI Trial

基于固定版本 DSH 的独立应用，业务通过插件扩展，不修改上游 Core。

```sh
pnpm install
pnpm start
```

打开终端输出的认证链接，默认端口 3080。在设置中配置模型和凭据，再到流水线页面模拟一次 CI 失败或 Commit。

流水线使用 `@lai/lai-agents` ：`iqe-orchestrator` 主 Agent 自己负责 Monitor，再通过五个真实委派工具依次调用 Triage → Reproduction → Ticket → Reviewer → Reporting 子 Agent。各角色 Prompt 可以在设置中修改。

当前只模拟输入，模型分析和本地工具调用真实执行。工单草稿和报告保存在本地。无需 MQ、共享知识库或外部 CI 账号；未来 CI/GitHub 插件可通过相同事件源接口接入。

原版 DSH 调试入口：`/dsh/`。用户配置、凭据与会话位于 Git 忽略的 `.runtime/dsh`。重复启动前先停止占用 3080 的旧实例。

架构说明见 [architecture](docs/architecture.md)，本地检查使用 `pnpm check`。

默认模拟仅检查 `add(1, 1)` 错误返回 `3`，每阶段简短输出，复现最多执行一次脚本。不会自动发起付费模拟运行。
