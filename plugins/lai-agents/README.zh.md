# @lai/lai-agents

Superagent Router is the Monitor. Each accepted task runs in a separate Worker using `iqe-orchestrator`. Its five delegation tools are `triage`, `reproduce`, `ticket`, `review`, `reporter`, using the existing five `iqe-*` specialist presets. There is no separate Monitor preset or delegation tool.

This is an independent DSH Bundle with its own sidebar entry and plugin configuration view. Configure prompts and specialist model routes through LAI Web Plugin → LAI Agents or `lai-agents.config.prompts`: `orchestrator`, `triage`, `reproduce`, `ticket`, `review`, `report`. Each prompt is resolved through the public DSH system prompt service at the next assembly. Existing custom prompts for retained roles are preserved.

The orchestrator owns observation tools and native DSH delegation tools. Calls, tool receipts, child conversations and completions appear in the original DSH UI. Registrations are owned by Cordis effects; no DSH Core changes are required.

Specialist model overrides are stored in `lai-agents.config.models` for `triage`, `reproduce`, `ticket`, `review` and `report`. An unset role inherits the Worker route. Overrides apply to newly created children without changing the global default or existing durable selections. Configure the Worker model through Superagent Execution.

## 专业子 Agent 的工具选择

lai-web 和原版 DSH 的 LAI Agents 配置页以角色卡片平铺，展示职责、模型、工具数量和 Prompt 预览。卡片底部的 Prompt、模型、工具按钮打开弹窗；应用到页面草稿后再保存配置，取消弹窗不改变草稿。工具按已安装插件分组，每个专业角色可以使用默认工具或逐项勾选。`tools.<role>` 缺失或为 `null` 表示默认，`[]` 表示不选择工具清单中的任何工具。Worker 的五个委派工具保持固定，不在此处编辑。

工具选择使用 DSH 设置接口和版本检查保存。新建 Run 在 `DSH_HOME/lai-agents/tool-selections` 留存自己的选择；后续配置修改和进程重启不改变已有快照。没有快照的旧 Run 保留 Preset 默认工具。插件缺失时工具不可用，不用其他同名工具替代。选择工具不等于操作系统沙箱，也不能限制 Shell 间接执行的操作。

Superagent 仍应用工作工具限制、角色选择检查和 Ticket 结束后的执行拦截；Router 权限和五阶段顺序保持原约束。自定义插件安装到 Profile 后，LAI Agents 主动扫描 DSH 标准工具注册表，无需插件依赖或调用 laiAgents。插件使用 `ctx.tools.register()` 并由 Cordis effect 管理生命周期即可。外部工具显示在 Registered DSH tools 分组；公开接口没有来源包信息，不推测归属。条件激活工具暂不复制挂载，以保留其启用规则。示例见英文 README。
