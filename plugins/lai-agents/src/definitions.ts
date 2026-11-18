/** IQE role defaults and public DSH preset declarations. */
import type { PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'

export const DEFAULT_PROMPTS = {
  "orchestrator": "You are the IQE validation orchestrator. You receive a CI-validation task from an input event and run it through a six-stage pipeline by delegating to specialist subagents. Your delegation tools are exactly named monitor, triage, reproduce, ticket, review, and report; each starts one specialist subagent when you call it with a self-contained prompt. Match each stage to its exact tool name: stage 1 calls the tool named monitor, stage 2 calls triage, stage 3 calls reproduce, stage 4 calls ticket, stage 5 calls review, and stage 6 calls report. Start stage 1 by calling the monitor tool directly; do not search for other delegation mechanisms, and do not call wait_agent or list_agents before you have started a subagent. Pass absolute file paths from the task into each prompt, and pass forward the prior stage's findings. Do not do the specialist work yourself. Run stages in order; skip a stage only when the prior stage shows it is unnecessary (for example, no qualifying failure means no reproduction or ticket). After each delegation, wait for the completion notice, then delegate the next stage. Collect the reviewed result and produce the final report. Begin your final answer with the exact token [IQE-PIPELINE] on its own line, then give the consolidated outcome concisely.",
  "monitor": "You are the IQE monitor agent. Watch CI results (Jenkins jobs, test results, logs, artifacts, code changes, and configurations), identify failures, regressions, and anomalies, filter noise, and prioritize issues. Use shell commands and web fetches to query CI systems and read-only file access to inspect logs and artifacts; do not modify files. Output a concise failure/regression alert list with severity and the evidence location for each item.",
  "triage": "You are the IQE triage agent. For each surfaced failure, collect evidence (logs, configs, changes, history) using available skills and CLI tools such as Jarvis and LogDistiller through the shell, then classify the root cause (driver, test, environment, infrastructure, etc.). Read files and search logs; do not modify files. Output a triage analysis with a root-cause classification and supporting evidence per failure.",
  "reproduce": "You are the IQE reproduction agent. Reproduce qualifying failures with controlled reruns, collect additional logs and artifacts, and validate reproducibility. You may run commands and write artifacts and test configurations under the workspace. Output reproduction results with the exact steps, observed outcome, and whether the failure is reproducible.",
  "ticket": "You are the IQE ticket agent. Prepare a Jira or Azure ticket draft for each validated failure: include logs, root-cause analysis, and reproduction steps; check for duplicates and link related issues; set priority and assign the right team. Query ticket systems through web fetches or shell commands and write draft tickets under the workspace. Do not submit tickets externally unless explicitly instructed. Output the draft ticket with evidence.",
  "review": "You are the IQE reviewer agent. Independently check the diagnosis and evidence: validate the root cause and reproduction quality, ensure there are no duplicate tickets, then approve, request more information, or reject. You have read-only access; do not modify files or run destructive commands. Output a validated result stating approve/request-info/reject with reasons.",
  "report": "You are the IQE reporting agent. Consolidate validated results into the daily staging-CI report, track metrics (failures, RCAs, turnaround time, trends), and highlight risks and open issues. Read prior reports and write the updated report under the workspace. Output the daily staging-CI report summary."
}

export const PRESETS: readonly PresetDefinition[] = [
  {
    "id": "iqe-orchestrator",
    "order": 10,
    "plugins": [
      {
        "id": "persona",
        "name": "@deepseek-ai/dsh-persona",
        "config": {
          "prefix": "{{lai_agent_orchestrator}}"
        }
      },
      {
        "id": "tool-fs",
        "name": "@deepseek-ai/dsh-tool-fs",
        "config": {
          "read": true,
          "readImage": true,
          "write": false,
          "edit": false,
          "applyPatch": false
        }
      },
      {
        "id": "tool-todo",
        "name": "@deepseek-ai/dsh-tool-todo",
        "config": {
          "allowParallelInProgress": true
        }
      },
      {
        "id": "tool-subagent-control",
        "name": "@deepseek-ai/dsh-tool-subagent-control"
      },
      {
        "id": "delegate-monitor",
        "name": "@deepseek-ai/dsh-tool-subagent",
        "config": {
          "provider": "spawn",
          "toolName": "monitor",
          "agentPreset": "iqe-monitor",
          "maxDepth": 1
        }
      },
      {
        "id": "delegate-triage",
        "name": "@deepseek-ai/dsh-tool-subagent",
        "config": {
          "provider": "spawn",
          "toolName": "triage",
          "agentPreset": "iqe-triage",
          "maxDepth": 1
        }
      },
      {
        "id": "delegate-reproduce",
        "name": "@deepseek-ai/dsh-tool-subagent",
        "config": {
          "provider": "spawn",
          "toolName": "reproduce",
          "agentPreset": "iqe-reproduction",
          "maxDepth": 1
        }
      },
      {
        "id": "delegate-ticket",
        "name": "@deepseek-ai/dsh-tool-subagent",
        "config": {
          "provider": "spawn",
          "toolName": "ticket",
          "agentPreset": "iqe-ticket",
          "maxDepth": 1
        }
      },
      {
        "id": "delegate-review",
        "name": "@deepseek-ai/dsh-tool-subagent",
        "config": {
          "provider": "spawn",
          "toolName": "review",
          "agentPreset": "iqe-reviewer",
          "maxDepth": 1
        }
      },
      {
        "id": "delegate-report",
        "name": "@deepseek-ai/dsh-tool-subagent",
        "config": {
          "provider": "spawn",
          "toolName": "report",
          "agentPreset": "iqe-reporting",
          "maxDepth": 1
        }
      }
    ]
  },
  {
    "id": "iqe-monitor",
    "order": 11,
    "plugins": [
      {
        "id": "persona",
        "name": "@deepseek-ai/dsh-persona",
        "config": {
          "prefix": "{{lai_agent_monitor}}"
        }
      },
      {
        "id": "tool-web",
        "name": "@deepseek-ai/dsh-tool-web",
        "config": {
          "fetch": true
        }
      },
      {
        "id": "tool-fs",
        "name": "@deepseek-ai/dsh-tool-fs",
        "config": {
          "read": true,
          "readImage": true,
          "write": false,
          "edit": false,
          "applyPatch": false
        }
      },
      {
        "id": "tool-fs-search",
        "name": "@deepseek-ai/dsh-tool-fs-search",
        "config": {
          "sampleOverCapGlobResults": false
        }
      },
      {
        "id": "tool-bash",
        "name": "@deepseek-ai/dsh-tool-bash",
        "disabled": process.platform === 'win32'
      },
      {
        "id": "compaction",
        "name": "cordis:group",
        "group": true,
        "isolate": {
          "compaction": true
        },
        "config": [
          {
            "id": "compaction-basic",
            "name": "@deepseek-ai/dsh-compaction-basic"
          },
          {
            "id": "command-compact",
            "name": "@deepseek-ai/dsh-command-compact"
          }
        ]
      }
    ]
  },
  {
    "id": "iqe-triage",
    "order": 12,
    "plugins": [
      {
        "id": "persona",
        "name": "@deepseek-ai/dsh-persona",
        "config": {
          "prefix": "{{lai_agent_triage}}"
        }
      },
      {
        "id": "skill-filesystem",
        "name": "@deepseek-ai/dsh-skill-filesystem"
      },
      {
        "id": "tool-skill",
        "name": "@deepseek-ai/dsh-tool-skill"
      },
      {
        "id": "tool-bash",
        "name": "@deepseek-ai/dsh-tool-bash",
        "disabled": process.platform === 'win32'
      },
      {
        "id": "tool-fs",
        "name": "@deepseek-ai/dsh-tool-fs",
        "config": {
          "read": true,
          "readImage": true,
          "write": false,
          "edit": false,
          "applyPatch": false
        }
      },
      {
        "id": "tool-fs-search",
        "name": "@deepseek-ai/dsh-tool-fs-search",
        "config": {
          "sampleOverCapGlobResults": false
        }
      },
      {
        "id": "compaction",
        "name": "cordis:group",
        "group": true,
        "isolate": {
          "compaction": true
        },
        "config": [
          {
            "id": "compaction-basic",
            "name": "@deepseek-ai/dsh-compaction-basic"
          },
          {
            "id": "command-compact",
            "name": "@deepseek-ai/dsh-command-compact"
          }
        ]
      }
    ]
  },
  {
    "id": "iqe-reproduction",
    "order": 13,
    "plugins": [
      {
        "id": "persona",
        "name": "@deepseek-ai/dsh-persona",
        "config": {
          "prefix": "{{lai_agent_reproduce}}"
        }
      },
      {
        "id": "tool-bash",
        "name": "@deepseek-ai/dsh-tool-bash",
        "disabled": process.platform === 'win32'
      },
      {
        "id": "tool-fs",
        "name": "@deepseek-ai/dsh-tool-fs",
        "config": {
          "read": true,
          "readImage": true,
          "write": true,
          "edit": true,
          "applyPatch": false
        }
      },
      {
        "id": "tool-fs-search",
        "name": "@deepseek-ai/dsh-tool-fs-search",
        "config": {
          "sampleOverCapGlobResults": false
        }
      },
      {
        "id": "tool-jobs",
        "name": "@deepseek-ai/dsh-tool-jobs"
      },
      {
        "id": "compaction",
        "name": "cordis:group",
        "group": true,
        "isolate": {
          "compaction": true
        },
        "config": [
          {
            "id": "compaction-basic",
            "name": "@deepseek-ai/dsh-compaction-basic"
          },
          {
            "id": "command-compact",
            "name": "@deepseek-ai/dsh-command-compact"
          }
        ]
      }
    ]
  },
  {
    "id": "iqe-ticket",
    "order": 14,
    "plugins": [
      {
        "id": "persona",
        "name": "@deepseek-ai/dsh-persona",
        "config": {
          "prefix": "{{lai_agent_ticket}}"
        }
      },
      {
        "id": "tool-web",
        "name": "@deepseek-ai/dsh-tool-web",
        "config": {
          "fetch": true
        }
      },
      {
        "id": "tool-bash",
        "name": "@deepseek-ai/dsh-tool-bash",
        "disabled": process.platform === 'win32'
      },
      {
        "id": "tool-fs",
        "name": "@deepseek-ai/dsh-tool-fs",
        "config": {
          "read": true,
          "readImage": true,
          "write": true,
          "edit": true,
          "applyPatch": false
        }
      },
      {
        "id": "tool-fs-search",
        "name": "@deepseek-ai/dsh-tool-fs-search",
        "config": {
          "sampleOverCapGlobResults": false
        }
      },
      {
        "id": "compaction",
        "name": "cordis:group",
        "group": true,
        "isolate": {
          "compaction": true
        },
        "config": [
          {
            "id": "compaction-basic",
            "name": "@deepseek-ai/dsh-compaction-basic"
          },
          {
            "id": "command-compact",
            "name": "@deepseek-ai/dsh-command-compact"
          }
        ]
      }
    ]
  },
  {
    "id": "iqe-reviewer",
    "order": 15,
    "plugins": [
      {
        "id": "persona",
        "name": "@deepseek-ai/dsh-persona",
        "config": {
          "prefix": "{{lai_agent_review}}"
        }
      },
      {
        "id": "tool-fs",
        "name": "@deepseek-ai/dsh-tool-fs",
        "config": {
          "read": true,
          "readImage": true,
          "write": false,
          "edit": false,
          "applyPatch": false
        }
      },
      {
        "id": "tool-fs-search",
        "name": "@deepseek-ai/dsh-tool-fs-search",
        "config": {
          "sampleOverCapGlobResults": false
        }
      },
      {
        "id": "tool-bash",
        "name": "@deepseek-ai/dsh-tool-bash",
        "disabled": process.platform === 'win32'
      },
      {
        "id": "compaction",
        "name": "cordis:group",
        "group": true,
        "isolate": {
          "compaction": true
        },
        "config": [
          {
            "id": "compaction-basic",
            "name": "@deepseek-ai/dsh-compaction-basic"
          },
          {
            "id": "command-compact",
            "name": "@deepseek-ai/dsh-command-compact"
          }
        ]
      }
    ]
  },
  {
    "id": "iqe-reporting",
    "order": 16,
    "plugins": [
      {
        "id": "persona",
        "name": "@deepseek-ai/dsh-persona",
        "config": {
          "prefix": "{{lai_agent_report}}"
        }
      },
      {
        "id": "tool-fs",
        "name": "@deepseek-ai/dsh-tool-fs",
        "config": {
          "read": true,
          "readImage": true,
          "write": true,
          "edit": true,
          "applyPatch": false
        }
      },
      {
        "id": "tool-fs-search",
        "name": "@deepseek-ai/dsh-tool-fs-search",
        "config": {
          "sampleOverCapGlobResults": false
        }
      },
      {
        "id": "tool-present",
        "name": "@deepseek-ai/dsh-tool-present"
      },
      {
        "id": "tool-web",
        "name": "@deepseek-ai/dsh-tool-web",
        "config": {
          "fetch": true
        }
      },
      {
        "id": "compaction",
        "name": "cordis:group",
        "group": true,
        "isolate": {
          "compaction": true
        },
        "config": [
          {
            "id": "compaction-basic",
            "name": "@deepseek-ai/dsh-compaction-basic"
          },
          {
            "id": "command-compact",
            "name": "@deepseek-ai/dsh-command-compact"
          }
        ]
      }
    ]
  }
]
