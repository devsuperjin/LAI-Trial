# @lai/lai-agents

One `iqe-orchestrator` handles monitoring and dispatch. Its five delegation tools are `triage`, `reproduce`, `ticket`, `review`, `report`, using the existing five `iqe-*` specialist presets. There is no separate Monitor preset or delegation tool.

Configure prompts through LAI Web Settings or `lai-agents.config.prompts`: `orchestrator`, `triage`, `reproduce`, `ticket`, `review`, `report`. Each prompt is resolved through the public DSH system prompt service at the next assembly. Existing custom prompts for retained roles are preserved.

The orchestrator owns observation tools and native DSH delegation tools. Calls, tool receipts, child conversations and completions appear in the original DSH UI. Registrations are owned by Cordis effects; no DSH Core changes are required.
