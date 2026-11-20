# LAI 架构

[English](architecture.md) | **简体中文**

LAI 是独立的 DSH 应用仓库，使用已发布的包；官方依赖固定到 `config/dsh-baseline.json`，当前基线为 `0.2.2-rc.1`。不复制或修改官方框架源码。`config/profile.json` 组合官方 Bundle 与 `@lai` 应用插件，设置和会话保存在独立的 `.runtime/dsh`。

## 执行与职责

```text
GitHub / 可选 Feishu / Jenkins Sources
  → Superagent Router(Monitor)
  → LAI Orchestrator (Worker · iqe-orchestrator)
      triage → reproduce → ticket → review → reporter
```

Monitor / Router 是一个业务角色，统一负责接入、去重、范围／准入检查、评估及路由。确定性检查由程序执行，需要语义判断的请求／候选由 Router 主会话处理，程序校验并应用决策。图中不把这些实现步骤拆成额外 Agent。

Router 和 Worker 是通过 Superagent Ticket 关联的独立会话。每个 Worker 使用 `iqe-orchestrator`，五个专业阶段是它的 DSH 原生子 Agent。阶段箭头表示顺序，不表示前一个子 Agent 创建后一个；委派均由 Worker 发起。

`plugins/superagent/src/app/lai-worker.ts` 检查真实子会话历史，一次只允许一个阶段。子 Agent 失败或取消后阻止后续阶段；全部完成后才允许 `ready`。每次 Assignment 按自身开始时间识别进度。Ticket 管理任务，Ticket 子 Agent 整理工单草稿，两者不同。

## 目录与边界

| 目录 | 职责 |
| --- | --- |
| `plugins/superagent` | Sources、Policy、Router、Ticket、Worker 调度、持久化、重试、回复；是导入并维护的业务插件，不是官方框架源码 |
| `plugins/lai-agents` | Worker 和五个专业预设、Prompt、角色模型覆盖、工具选择、Skill 组合 |
| `plugins/credentials` | 凭证配置、按预设授权的读取／更新工具、独立的 scoped Skill 入口 |
| `plugins/feishu-tools` | 独立飞书操作工具；不是 Superagent 飞书输入来源，不另起监听器 |
| `plugins/web-host` | 同源鉴权、静态界面、归档查询及 `/dsh/` 原版界面 |
| `packages/dsh-adapter` | 浏览器 RPC、应用管理协议及基线兼容；Node-only host 入口不进入浏览器 |
| `app/lai-web` | 任务、运行、配置与结果界面 |
| `config` | Profile / Bundle 和默认值；不保存真实凭证 |

旧 `lai-pipeline`、`pipeline-simulator` 和来源注册接口已移除，不作为当前开发入口。不需要 MQ、broker 或共享知识服务。不同 Ticket 的并发由 Superagent Execution 管理；单个 Worker 内部严格串行。

## Web 布局

`app/lai-web/src/router/routes.tsx` 是唯一静态路由／菜单配置，包含 path、component、name、icon、order、group、hideInMenu 等元信息。菜单、面包屑、标题和渲染器从中派生。Hash 地址支持刷新及浏览器前进／后退，无需修改 DSH 服务端路由协议。

`src/layout/` 统一外壳、页面标题、宽度、间距、Card、Tab 和刷新操作；标题在内容 Card 外。`src/pages/` 放页面，`src/components/` 放复用组件，不保留页面转发文件。共享运行加载器为 `components/RunDetailLoader.tsx`。

Settings 管理外观、构建／插件版本和模型提供方配置；Plugin 下分别配置 Superagent、LAI Agents、飞书工具及 Agent 可访问的 Credentials。版本展示来自构建时的 manifest，不表示插件实时启用状态。

## 工具、Skill 与凭证

每个专业子 Agent 默认启用 `skill`，并在自身 preset scope 挂载 `@lai/credentials/skill` 的 `credentials-access`。正文按需加载；角色 Prompt 开头只保留简短 Skill 发现指引，不预先塞入凭证操作全文。已有工具选择通过一次性迁移补上 `skill`，之后尊重手动取消；已有 Run 快照不变。

凭证工具与凭证授权独立。插件每次执行均检查 DSH 提供的 `exec.agent.session.header.agentPreset`、凭证启用状态和 `allowedPresets`。读取权限按 preset，不按单个子 Agent 实例划分。更新额外要求 `allowUpdates`，只能替换已有本地记录的 username/token/password，不能创建凭证、修改授权或自动轮换远端账号。

Modal 支持 API endpoint、IP／主机名、端口和访问说明。普通设置读取脱敏；眼睛图标经鉴权管理接口显式读取原值。留空保留已有值，写入带 revision 检查。模型读取和更新参数可能保存在 Run 历史中；撤权只能阻止后续调用，不能收回已读内容。

## 生命周期与数据

注册通过 Cordis effect 持有和释放；释放依赖前等待取消、子任务和 Worker 退出。现有设置和会话必须保留。DSH Home 默认为 `.runtime/dsh`，Superagent 状态默认为 `.runtime/dsh/superagent`，可通过 `LAI_SUPERAGENT_STATE_DIR` 显式覆盖；不得让两个进程共用活动状态目录。

`pnpm install` 后用 `pnpm start` 构建并运行，或用 `pnpm build`、`pnpm start:backend` 分开执行；不打开浏览器使用 `--no-open`。默认端口 3080。默认 Eval 为 observe，接收事件不等于执行。`.reference` 仅用于迁移审计，不进入运行、构建、测试或 CI。

## 分支、版本与交付

新增插件必须从最新 `main` 创建独立分支，提交 PR 到 `main` 并通过 PR 合并，不直接在 `main` 新增插件。每次修改组件（包括其文档）都要在同一改动中 bump 对应 package.json：兼容修复／文档默认 patch，新功能 minor，不兼容变更 major，用户指定版本优先。全应用改动也更新根版本；不要顺带修改官方 DSH 基线。

常规集成检查为 `pnpm check`，真实模型验证另行执行；用户明确禁止测试、验证或浏览器时遵守该限制并报告实际执行内容。完整协作约束见 [AGENTS.md](../AGENTS.md)，开发流程见[开发架构与上游同步参考](development-architecture-reference.zh.md)。
