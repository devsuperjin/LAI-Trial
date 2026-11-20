# @lai/lai-agents

Superagent Router(Monitor) 负责监控与路由。每个接单任务由独立 Worker 使用 `iqe-orchestrator` 协调，依次调用 `triage`、`reproduce`、`ticket`、`review`、`reporter` 五个原生子 Agent。Monitor 不是 Worker 的子 Agent，没有单独的 Monitor 委派工具。

本包是独立的 DSH Bundle。通过 Plugin → LAI Agents 配置 `orchestrator`、`triage`、`reproduce`、`ticket`、`review`、`report` 六个角色 Prompt。公开系统提示词服务在下一次组装时读取配置；原有自定义角色正文保留，共享 Skill 引导去重后放在最前面。

委派调用、工具结果、子会话和完成通知保留在 DSH 原生执行历史中，原版界面也能查看。注册由 Cordis effects 持有，不修改官方 DSH Core。串行与真实完成检查由 Superagent 的 LAI Worker 集成负责。

角色模型覆盖保存在 `lai-agents.config.models`，作用于新建专业子 Agent；未设置时继承 Worker 模型，不修改全局默认或已有持久选择。Worker 模型通过 Plugin → Superagent → Execution 配置。

## 专业子 Agent 的工具选择

lai-web 和原版 DSH 的 LAI Agents 配置页以角色卡片平铺，展示职责、模型、工具数量和 Prompt 预览。卡片底部的 Prompt、模型、工具按钮打开弹窗；应用到页面草稿后再保存配置，取消弹窗不改变草稿。工具按已安装插件分组，每个专业角色可以使用默认工具或逐项勾选。`tools.<role>` 缺失或为 `null` 表示默认，`[]` 表示不选择工具清单中的任何工具。Worker 的五个委派工具保持固定，不在此处编辑。

工具选择使用 DSH 设置接口和版本检查保存。新建 Run 在 `DSH_HOME/lai-agents/tool-selections` 留存自己的选择；后续配置修改和进程重启不改变已有快照。没有快照的旧 Run 保留 Preset 默认工具。插件缺失时工具不可用，不用其他同名工具替代。选择工具不等于操作系统沙箱，也不能限制 Shell 间接执行的操作。

Superagent 仍应用工作工具限制、角色选择检查和 Ticket 结束后的执行拦截；Router 权限和五阶段顺序保持原约束。自定义插件安装到 Profile 后，LAI Agents 主动扫描 DSH 标准工具注册表，无需插件依赖或调用 laiAgents。插件使用 `ctx.tools.register()` 并由 Cordis effect 管理生命周期即可。外部工具显示在 Registered DSH tools 分组；公开接口没有来源包信息，不推测归属。条件激活工具暂不复制挂载，以保留其启用规则。示例见英文 README。

## Skill、凭证与页面

五个专业子 Agent 默认启用 `skill`，各自 preset scope 挂载 `@lai/credentials/skill` 的 `credentials-access`，不在全局发布该 Skill。正文按需加载，角色 Prompt 开头只有简短引导：上下文不足或缺少思路时先看 Skill 简介并加载相关内容，避免重复加载已有内容。Worker 协调者不自动挂载此凭证 Skill。

一次性版本化迁移会给已有显式工具选择补上 `skill`，保留其他选择；之后尊重用户手动关闭。已有 Run 的工具快照不变。凭证工具仍需单独选择，每条凭证另按调用者的真实 preset 授权；更新还需 `allowUpdates`。Skill 不扩大任何权限。

页面为 `/#/plugins/lai-agents`，实现位于 `app/lai-web/src/pages/LaiAgentsPage.tsx`。路由、菜单和标题来自 `src/router/routes.tsx`，公共布局来自 `src/layout`。组件目录不放页面或转发文件。

## 维护流程

本组件每次变更（包括文档）均 bump 自己的 package.json 版本；新增插件从最新 main 新开独立分支，经 PR 合并，不直接在主分支新增插件。详见 [AGENTS.md](../../AGENTS.md) 和[中文架构说明](../../docs/architecture.zh.md)。
