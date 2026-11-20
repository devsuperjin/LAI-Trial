# 术语表

[English](glossary.md) | **简体中文**


## 角色与执行

| 术语 | 含义 |
| --- | --- |
| LAI | Linux Agent Infra 的简写。 |
| LAI Superagent | Linux Agent Infra X Superagent，基于 DeepSeek Harness 构建的应用。 |
| DSH / DeepSeek Harness | 提供模型、会话、工具、原生子 Agent 和插件能力的底层运行时。 |
| Superagent Router(Monitor) | 监控与路由角色，涵盖事件接入、准入、评估、任务路由和后续消息。规则检查由程序执行，语义判断使用其模型主会话。 |
| LAI Orchestrator | 接单任务的执行协调者，使用 `iqe-orchestrator` 预设，按顺序委派五个原生子 Agent。 |
| Specialist / subagent（专业子 Agent） | LAI Orchestrator 的原生子 Agent，不是无关联的根会话。五个阶段为 Triage → Reproduction → Ticket 工单草稿 → Reviewer → Reporting。 |
| Ticket | Superagent 的任务实体，关联请求、授权、工作区和执行记录；与整理工单草稿的 Ticket 子 Agent 不同。 |
| Assignment | Ticket 的一次派工；阶段进度按当前 Assignment 的范围识别。 |
| Session / Run | Session 是 DSH 原生对话和持久执行历史；Run 是应用界面对执行记录的称呼。Superagent Router(Monitor)、LAI Orchestrator 和每个子 Agent 分别拥有会话。 |
| Source（来源） | 提交外部事件的连接器，例如 GitHub、Jenkins 或可选飞书对话来源。 |
| Trigger（触发事件） | Source 接收到并规范化的输入事件；收到事件本身不代表获准执行。 |
| Thread（对话主题） | 用于关联事件、后续消息和任务的对话或主题。 |
| Decision（判断记录） | 带原因的路由或评估结果，例如接单、续做、停止、忽略或评估不可用。 |
| Policy / Admission（策略／准入） | 约束接收范围、允许发起者和任务受理的规则；与接单后的执行指令不同。 |
| Eval（候选评估） | `off` 关闭推断候选评估；`observe` 记录判断而不自动执行推断任务；`auto` 在策略允许时受理推断任务。明确授权的请求走对应路由流程。 |

## 能力与访问

| 术语 | 含义 |
| --- | --- |
| Tool（工具） | 挂载给 Agent 的可执行能力；插件注册工具不代表每个专业角色都默认选择它。 |
| Skill（技能说明） | 可发现、通过 `skill` 工具按需加载的操作说明；加载 Skill 不会自动授予工具或数据权限。 |
| `credentials-access` | Credentials 插件的 Skill，在五个专业角色的 preset scope 内挂载，说明凭证发现、读取及获授权的本地更新流程。 |
| Preset（预设） | 定义角色和插件组合的具名 Agent 配置；凭证授权目前按调用会话的真实 preset 身份检查。 |
| Scope（作用域） | 限定插件注册、工具和 Skill 可见性的边界；preset scope 内的 Skill 不在全局发布。 |
| 服务凭证 | Plugin → Credentials 管理的连接与认证信息，包括 endpoint、host/IP、端口、说明及可选用户名／token／密码。 |
| 模型提供方 API key | Settings → Model configuration 中配置、用于模型推理的凭证，与 Agent 可访问的服务凭证分开。 |
| 凭证授权 | 每次调用检查该条目的启用状态及允许的 preset；Agent 工具选择是另一项独立要求。 |
| 凭证更新／轮换 | `credentials_update` 在开启更新权限后替换已有本地记录。远端账号轮换是需要明确授权的独立操作。 |
| Feishu Source / Feishu tools | Source 接收飞书对话事件供监控处理；独立工具插件使用自身配置执行所选飞书操作，不是另一个输入监听器。 |

## 应用结构

| 术语 | 含义 |
| --- | --- |
| Plugin（插件） | 通过 Cordis 生命周期 effects 注册服务、工具、Skill 等能力的运行时扩展。 |
| Bundle / Profile | Bundle 提供打包的插件组合；应用 Profile 为 LAI 实例组合 Bundle、默认值和运行时设置。 |
| Workspace（工作区） | 任务执行使用的目录与环境，不等于 Session 或 Ticket。 |
| 构建版本 | Web 构建时从应用和插件 manifest 读取的版本，不表示哪些插件当前已启用。 |
