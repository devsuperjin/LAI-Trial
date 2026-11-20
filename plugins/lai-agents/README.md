# @lai/lai-agents

Superagent Router is the Monitor. Each accepted task runs in a separate Worker using `iqe-orchestrator`. Its five delegation tools are `triage`, `reproduce`, `ticket`, `review`, `reporter`, using the existing five `iqe-*` specialist presets. There is no separate Monitor preset or delegation tool.

This is an independent DSH Bundle with its own sidebar entry and plugin configuration view. Configure prompts and specialist model routes through LAI Web Plugin → LAI Agents or `lai-agents.config.prompts`: `orchestrator`, `triage`, `reproduce`, `ticket`, `review`, `report`. Each prompt is resolved through the public DSH system prompt service at the next assembly. Existing custom prompts for retained roles are preserved.

The orchestrator owns observation tools and native DSH delegation tools. Calls, tool receipts, child conversations and completions appear in the original DSH UI. Registrations are owned by Cordis effects; no DSH Core changes are required.

Specialist model overrides are stored in `lai-agents.config.models` for `triage`, `reproduce`, `ticket`, `review` and `report`. An unset role inherits the Worker route. Overrides apply to newly created children without changing the global default or existing durable selections. Configure the Worker model through Superagent Execution.

## Per-specialist tools

LAI Web and the native DSH LAI Agents configuration page show a grid of role cards with responsibilities, model routes, tool counts and prompt previews. The Prompt, Model and Tools buttons open a modal editor. Apply changes to the page draft, then save configuration; cancelling the modal leaves the draft unchanged. Built-in tools are grouped by known capability packages; externally registered tools are discovered from the public DSH registry under Registered DSH tools. Each specialist can use role defaults or an explicit selection. `null` / missing preserves defaults; `[]` selects no catalog tools. Worker delegation tools are fixed and are not part of this selector.

Selections are saved through DSH settings with revision checks. New specialist Runs capture them once in `DSH_HOME/lai-agents/tool-selections`; existing Runs keep their captured selections across settings changes and restarts. Older Runs without a snapshot keep their preset defaults. Unavailable plugins remain unavailable instead of being replaced by another tool with the same name. Tool selection does not create an OS sandbox or revoke capabilities reachable through Shell.

Superagent still applies its work-tool restrictions and ended-Ticket guard. It explicitly consults the LAI selection before admitting additional work tools. Native inherited tools are masked when deselected; dynamically mounted tools also have an execution guard. This does not relax Router restrictions or five-stage order.

### Discover custom tools

Install a standard DSH tool plugin into the application Profile. LAI Agents scans the public `tools.definitions()` registry; the plugin does not depend on LAI Agents:

```ts
import type { Context } from '@deepseek-ai/cordis'
import { sendMessageTool, readMessageTool } from './tools.js'
export const inject = ['tools']
export function apply(ctx: Context) {
  for (const tool of [sendMessageTool, readMessageTool]) {
    ctx.effect(() => ctx.tools.register(tool))
  }
}
```

Select discovered tools in LAI Agents → specialist → Tools → Registered DSH tools. The public registry does not expose package ownership, so external tools are not attributed to guessed package names. Step-conditional registrations are excluded from cloning to preserve their activation rules. Tool removal is checked before execution. Credentials and configuration remain owned by the supplying plugin. Globally registered tools may be visible to other DSH agents according to their own scope restrictions; LAI specialist selections do not change other agents.

### Credentials Skill

Each specialist preset composes `@lai/credentials/skill` and the standard DSH skill tool. This registers `credentials-access` within that preset scope rather than globally or in the role prompt. The standard `skill` tool is enabled by default; enable whichever `credentials_list`, `credentials_get`, and `credentials_update` tools the role needs in its saved tool selection. Credential entries separately grant preset access; updates additionally require the entry's explicit `allowUpdates` setting. Other explicit tool selections are preserved; the one-time migration below adds only the Skill capability.

All five specialists enable the standard `skill` capability by default. A one-time versioned migration adds `skill` to existing explicit role tool selections without granting credential tools or changing other selected tools. Subsequent explicit opt-outs are respected. Existing Run snapshots remain unchanged; create a new subagent to use the updated selection.

Specialist prompts begin with a short shared Skill discovery hint: when context or an investigation approach is missing, consult available descriptions and load a relevant Skill before speculative investigation. The hint is also applied to saved custom role prompts, deduplicated on assembly, and leaves the role instructions intact. It does not preload Skill bodies or expand permissions.

## Maintenance

Five specialists share a short Skill discovery hint at the start of their prompts; the Worker coordinator is not given a credentials Skill automatically. Keep role text and tool/preset authorization separate from Skill content. Configure this page at `/#/plugins/lai-agents`; its implementation is `app/lai-web/src/pages/LaiAgentsPage.tsx`, selected by the shared route configuration.

Every change to this package, including its documentation, bumps its own manifest version. New plugins use a dedicated branch and a PR into `main`; follow [AGENTS.md](../../AGENTS.md) and [architecture](../../docs/architecture.md).
