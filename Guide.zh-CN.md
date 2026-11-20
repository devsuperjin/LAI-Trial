# LAI 配置手册

[English](Guide.md) | **简体中文**

启动命令与系统介绍见 [README](README.zh-CN.md)。以下设置使用终端打印的鉴权地址打开，默认端口 3080。

## 首次配置

1. 在 **Settings** 配置模型 Provider、凭据和默认模型，LAI 角色 Prompt 和专业子 Agent 的模型覆盖在 **Plugin → LAI Agents** 配置。
2. 打开 **Plugin → Superagent → Sources**，填写 GitHub 仓库 `owner/repo`、GitHub CLI 路径及需要接收的事件。
3. 在 **Policy** 配置允许的发送者、任务范围和准入规则。
4. 在 **Eval** 配置判断模式、超时和 Superagent Router(Monitor) 模型。默认是 `observe`；需要自动受理推断任务时，按使用场景选择 `auto`。
5. 在 **Execution** 配置 LAI Orchestrator 模型、并发数、工作目录、工作区准备命令和命令限制。
6. 在 **Superagent Router(Monitor)** 查看受理任务，在 **Runs** 查看 Superagent Router(Monitor)、LAI Orchestrator 和子 Agent 的执行过程。

如果使用同一个 GitHub 账号发 Issue 和执行任务，需要同时开启新 Issue 接收和 **Receive issues opened by the agent account**。自己的评论和 PR 仍会被过滤；开关不会自动补跑此前已跳过的 Issue，接收后的 Issue 仍受 Policy 约束。

来源轮询间隔最低为 60 秒，实际间隔还会遵循 GitHub 的要求。配置完成后，使用一个目标明确的小任务开始，便于观察路由结果和模型费用。

## 页面与配置入口

| 页面 | 用途 |
| --- | --- |
| Dashboard | Superagent 事件与任务指标、Superagent Router(Monitor) / LAI Orchestrator 状态、五阶段活动和模型用量 |
| Superagent Router(Monitor) | 查看 Superagent 任务，打开对应 Superagent Router(Monitor) 或 LAI Orchestrator 会话 |
| Runs | 瀑布图 / 列表 Timeline、带网格的 DAG、原生子 Agent 与执行结果 |
| Plugin → Superagent | 独立的 Superagent 管理页面，包含 Sources、Policy、Eval、Execution、Prompts、Deployment |
| Plugin → LAI Agents | LAI Orchestrator 和专业角色 Prompt，以及各专业子 Agent 的模型覆盖和工具选择 |
| Plugin → Feishu tools | 独立飞书操作工具的 App ID、App Secret 或 Tenant Access Token |
| Plugin → Credentials | Agent 可访问的服务连接、凭证、预设授权与本地更新权限 |
| Settings | General：外观、语言和版本信息；Model configuration：Provider、凭据与默认模型 |

界面支持 EN / 中文切换。原版 DSH 调试界面保留在 **`/dsh/`**，与 lai-web 使用同一个后端。Runs 的删除操作使用 DSH 原生归档，支持 Undo；运行中的会话需要先停止。

Superagent 页面中的 **Prompts** 管理其 Superagent Router(Monitor) / LAI Orchestrator 工作指令，**Plugin → LAI Agents** 管理角色定义和专业子 Agent 的模型覆盖。它是独立 DSH Bundle，在原版 DSH 中也有独立侧栏和配置入口。未固定模型的子 Agent 继承 LAI Orchestrator 模型，模型覆盖仅影响新建子 Agent，不修改全局默认模型。来源、策略和执行设置会保留版本信息，保存时检查并发修改；高级配置编辑器用于访问基础表单之外的完整字段。

## Agent 服务凭证与 Skill

模型提供方 API key 在 Settings → Model configuration 中配置。供 Agent 调研外部系统使用的账号和连接信息则在 **Plugin → Credentials** 配置，两者独立。

1. 新增凭证，选择 Generic、API 或 SSH，填写 endpoint、host/IP、端口、用途及所需用户名／token／密码。允许只保存连接信息；说明可保留访问方法和环境信息。
2. 启用凭证并勾选允许访问的 Agent preset；默认不授权任何预设。同一 preset 的实例共享授权，`All agents` 表示显式授权全部预设。
3. 在 **Plugin → LAI Agents → 角色 → Tools** 选择 `credentials_list`、`credentials_get`，应用后保存。新子 Agent 使用新选择，已有 Run 快照不变。
4. 五个专业子 Agent 默认启用 `skill` 并挂载 `credentials-access`。需要时通过 `skill` 按需加载，正文不自动预加载。Skill 不代替工具或凭证授权。
5. 如需保存轮换后的本地值，再选择 `credentials_update` 并为该凭证开启“允许更新”。此工具不修改远端账号、不创建记录、不变更授权。远端轮换操作需要明确授权。

已配置字段显示圆点，通过眼睛图标显式查看；编辑时留空保留原值。模型读到的明文及工具参数可能进入 Run 历史。撤销授权阻止后续读取，不能收回已经披露的内容。

## 独立飞书工具

在 **Plugin → Feishu tools** 配置 App ID / App Secret 或 Tenant Access Token，再在 LAI Agents 中选择所需飞书工具。此配置与 **Plugin → Superagent → Sources** 的飞书输入来源独立，不会自动启动第二个消息监听器，也不会自动从 Credentials 插件读取配置。

## 保存与排查

角色弹窗中的“应用更改”只写入页面草稿，之后还需“保存配置”。设置写入带版本检查；出现冲突时重新加载后再修改。不要通过整份设置覆盖来解决冲突，避免丢失其他字段和凭证。

Settings → General 展示构建时的应用和插件版本；修改 manifest 后需要重新构建，不表示插件实时启用状态。页面支持 Hash 地址及浏览器前进／后退，例如 `/#/plugins/credentials`。
