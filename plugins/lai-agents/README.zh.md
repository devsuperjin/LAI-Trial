# @lai/lai-agents

Superagent Router is the Monitor. Each accepted task runs in a separate Worker using `iqe-orchestrator`. Its five delegation tools are `triage`, `reproduce`, `ticket`, `review`, `reporter`, using the existing five `iqe-*` specialist presets. There is no separate Monitor preset or delegation tool.

This is an independent DSH Bundle with its own sidebar entry and plugin configuration view. Configure prompts and specialist model routes through LAI Web Plugin → LAI Agents or `lai-agents.config.prompts`: `orchestrator`, `triage`, `reproduce`, `ticket`, `review`, `report`. Each prompt is resolved through the public DSH system prompt service at the next assembly. Existing custom prompts for retained roles are preserved.

The orchestrator owns observation tools and native DSH delegation tools. Calls, tool receipts, child conversations and completions appear in the original DSH UI. Registrations are owned by Cordis effects; no DSH Core changes are required.

Specialist model overrides are stored in `lai-agents.config.models` for `triage`, `reproduce`, `ticket`, `review` and `report`. An unset role inherits the Worker route. Overrides apply to newly created children without changing the global default or existing durable selections. Configure the Worker model through Superagent Execution.
