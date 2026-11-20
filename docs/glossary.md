# Glossary

**English** | [简体中文](glossary.zh-CN.md)

**LAI** stands for **Linux Agent Infra**. This glossary defines the names used by the application and its documentation.

## Roles and execution

| Term | Meaning |
| --- | --- |
| LAI | Linux Agent Infra. |
| LAI Superagent | Linux Agent Infra X Superagent, an application built on DeepSeek Harness. |
| DSH / DeepSeek Harness | The underlying runtime for models, sessions, tools, native subagents and plugins. |
| Superagent Router(Monitor) | The monitoring and routing role. It covers event intake, admission, assessment, task routing and follow-ups. Rule checks run in code; semantic decisions use its main model session. |
| LAI Orchestrator | The execution coordinator for an accepted task, using the `iqe-orchestrator` preset. It delegates to five native child agents in order. |
| Specialist / subagent | A native child agent of LAI Orchestrator, rather than an unrelated root session. The five stages are Triage → Reproduction → Ticket draft → Reviewer → Reporting. |
| Ticket | A Superagent task entity linking the request, authorization, workspace and execution. It is distinct from the Ticket drafting subagent. |
| Assignment | One dispatch of a Ticket to execution. Stage progress is scoped to the current Assignment. |
| Session / Run | A Session is a native DSH conversation and durable execution history. Run is the application's UI term for that execution record. Superagent Router(Monitor), LAI Orchestrator and each child have separate sessions. |
| Source | A connector that supplies external events, such as GitHub, Jenkins or optional Feishu conversations. |
| Trigger | A normalized event received from a Source. Receipt alone does not authorize execution. |
| Thread | A conversation or topic used to correlate events and follow-up messages with tasks. |
| Decision | A recorded routing or assessment outcome, such as acceptance, continuation, stop, ignore or unavailable assessment, with reasons. |
| Policy / Admission | Rules that constrain input scope, allowed requesters and task acceptance. They are distinct from the instructions used to execute an accepted task. |
| Eval | Candidate assessment settings. `off` disables inferred-candidate assessment; `observe` records outcomes without automatically executing inferred work; `auto` permits inferred acceptance when policy allows it. Explicit authorized requests follow their routing path. |

## Capabilities and access

| Term | Meaning |
| --- | --- |
| Tool | An executable capability mounted for an agent. Being registered by a plugin does not automatically select it for every specialist. |
| Skill | Discoverable instructions loaded on demand through the `skill` tool. Loading a Skill does not itself grant tools or data access. |
| `credentials-access` | The Credentials plugin's Skill, mounted within the five specialist preset scopes. It explains credential discovery, retrieval and authorized local updates. |
| Preset | A named agent configuration defining its role and mounted plugins. Credential grants currently use the calling session's preset identity. |
| Scope | The visibility boundary used for plugin registrations, tools and Skills. Preset-scoped Skills are not globally advertised. |
| Service credential | Connection and authentication data managed by Plugin → Credentials: endpoint, host/IP, port, notes and optional username/token/password. |
| Model-provider API key | A credential configured under Settings → Model configuration for model inference. It is separate from agent-accessible service credentials. |
| Credential grant | The entry's enabled state and allowed preset IDs, checked on every credential call. Tool selection remains a separate requirement. |
| Credential update / rotation | `credentials_update` persists replacements in an existing local record only when update permission is enabled. Rotating the remote account is a separate, explicitly authorized operation. |
| Feishu Source / Feishu tools | The Source receives conversation events for monitoring. The standalone tools plugin performs selected Feishu operations with its own configuration; it is not another input listener. |

## Application structure

| Term | Meaning |
| --- | --- |
| Plugin | A runtime extension that registers services, tools, Skills or other capabilities through Cordis lifecycle effects. |
| Bundle / Profile | A Bundle contributes packaged plugin composition. The application Profile composes bundles, defaults and runtime settings for the LAI instance. |
| Workspace | The working directory/environment assigned to task execution; it is not the Session or Ticket itself. |
| Build version | Application/plugin manifest versions captured when the web application is built. They do not indicate which plugins are currently enabled. |
