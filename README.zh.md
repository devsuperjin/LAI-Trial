# LAI Trial

基于固定版本 DSH 的独立应用，业务通过插件扩展，不修改上游 Core。

```sh
pnpm install
pnpm start
```

打开终端输出的认证链接，默认端口 3080。在设置中配置模型和凭据，再到流水线页面模拟一次 CI 失败或 Commit。

流水线使用 `@lai/lai-agents` 的六个角色：Monitor → Triage → Reproduction → Ticket → Reviewer → Reporting。通过 DSH 原生 subagent 接口依次执行，统一挂在 `iqe-orchestrator` 主 Agent 下。各角色 Prompt 可以在设置中修改。

当前只模拟输入，模型分析和本地工具调用真实执行。工单草稿和报告保存在本地。无需 MQ、共享知识库或外部 CI 账号；未来 CI/GitHub 插件可通过相同事件源接口接入。

原版 DSH 调试入口：`/dsh/`。用户配置、凭据与会话位于 Git 忽略的 `.runtime/dsh`。重复启动前先停止占用 3080 的旧实例。

架构说明见 [architecture](docs/architecture.md)，本地检查使用 `pnpm check`。
