import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Language = 'en' | 'zh'
const KEY = 'lai-web-language'
const ZH: Record<string, string> = {
  'Mode': '模式', 'off': '关闭', 'observe': '观察', 'auto': '自动', 'Timeout (seconds)': '超时（秒）', 'Concurrent Workers': 'Worker 并发数', 'Workspace prepare command': '工作区准备命令', 'Blocked commands (one per line)': '禁用命令（每行一个）', 'Inherit default model': '使用默认模型', 'Worker orchestrator': 'Worker 主 Agent',
  'Tasks': '任务', 'Monitor inputs and follow Worker tasks': '监控输入并查看 Worker 任务',
  'Monitor / Router → Worker → five LAI subagents': 'Monitor / Router → Worker → 五个 LAI 子 Agent',
  'Sources': '事件来源', 'Policy': '策略', 'Eval': '评估', 'Execution': '执行', 'Prompts': '提示词', 'Deployment': '部署',
  'Enabled': '启用', 'Save source': '保存来源', 'Not configured': '未配置',
  'Pause processing': '暂停处理', 'Resume processing': '恢复处理', 'Advanced source configuration': '来源完整配置',
  'Policy configuration': '策略配置', 'Eval configuration': '评估配置', 'Execution configuration': '执行配置',
  'Superagent prompt configuration': 'Superagent 提示词配置', 'Check deployment': '检查部署', 'State directory': '状态目录', 'Worker directory': 'Worker 目录',
  'Configure allowed senders, admission rules and task scope.': '配置允许的用户、准入规则和任务范围。',
  'Configure off / observe / auto mode, timeout and the Router model.': '配置关闭 / 观察 / 自动模式、超时和 Router 模型。',
  'Configure Worker model, concurrency, workspace preparation and command restrictions.': '配置 Worker 模型、并发数、工作区准备和命令限制。',
  'Open Monitor / Router': '打开 Monitor / Router', 'Open Worker run': '打开 Worker Run',
  'No tasks yet. Configure a source in Settings.': '暂无任务，请先在设置中配置事件来源。',
  'Select a task to view its Worker and results.': '选择任务，查看 Worker 和执行结果。', 'Routing decisions': '路由决策',
  'open': '未结束', 'working': '执行中', 'person': '等待处理', 'idle': '空闲', 'ended': '已结束', 'Previous': '上一页', 'Next': '下一页',

  'Dashboard': '概览', 'Pipeline': '流水线', 'History': '执行记录', 'Runs': 'Runs', 'Settings': '设置',
  'Agent pipeline': 'Agent 流水线', 'Agent workspace': 'Agent 工作空间',
  'Run classification & metrics': '执行分类与指标', 'Simulate events and follow the pipeline': '模拟事件与流水线执行',
  'Browse pipeline history and stage outputs': '查看历史执行与阶段输出', 'Run list, delegation activity, and results': '执行列表、委派调用与结果', 'Per-agent model configuration': 'Agent 模型配置',
  'Page content': '页面内容', 'Primary navigation': '主导航', 'Connected': '已连接', 'Connecting…': '连接中…',
  'Original DSH': '原版 DSH', 'Open the original DSH debugging interface': '打开原版 DSH 调试界面',
  'Run outcomes, agent activity, and token usage at a glance.': '查看执行结果、Agent 活动与 Token 用量。',
  'No runs yet. Configure a Superagent source in Settings, or start a task in DSH.': '暂无执行。请到流水线页面模拟输入，或在 DSH 中启动任务。',
  'Total runs': '累计执行', 'Completed': '已完成', 'Running': '运行中', 'Failed': '失败', 'Tokens': 'Token 用量',
  'Outcome': '执行结果', 'Success rate': '成功率', 'of settled runs': '（已结束的执行）', 'Runs by preset': '按预设统计',
  'Model usage': '模型使用情况', 'Pipeline stage activity': '流水线阶段活动', 'Tokens per run (chronological)': '每次执行的 Token 用量（按时间）',
  'Run': '执行', 'Status': '状态', 'Stages': '阶段', 'Duration': '耗时', 'Model': '模型', 'no runs match this filter': '没有符合筛选条件的执行',
  'LAI agents': 'LAI Agents', 'Models & prompts': '模型与提示词', 'Loading LAI agents…': '正在加载 LAI Agents…',
  'Simulate a CI failure or code change, then analyze, reproduce, draft, review, and report.': '模拟 CI 失败或代码变更，依次分析、复现、起草、审核与报告。',
  'Input sources': '输入源', 'Simulated inputs': '模拟输入', 'Cancel run': '停止执行',
  'Start with local fixtures. Connect CI or GitHub later through source plugins.': '先使用本地夹具跑通流程，之后通过事件源插件接入 CI 或 GitHub。',
  'No event source is enabled. Enable the simulator or install an input-source plugin.': '尚未启用事件源。请启用模拟器或安装事件源插件。',
  '1 orchestrator + 5 subagents': '1 个主 Agent + 5 个子 Agent',
  'The orchestrator monitors inputs and delegates sequentially to five specialist agents.': '主 Agent 监控输入，再依次调用五个专业子 Agent。',
  'Pipeline runs': '流水线执行', 'No events yet. Simulate an input above to start the six-stage flow.': '暂无事件。请在上方模拟输入以启动流程。',
  'output': '输出', 'Select a run to inspect its six stages, evidence and outputs.': '选择一次执行，查看阶段、证据与输出。',
  'The reviewer verdict stays attached to the report. Incomplete or rejected work is marked explicitly.': '报告保留审核结论，未完成或被拒绝的结果会明确标记。',
  'Reviewer decision:': '审核结论：', 'evidence files': '个证据文件', 'Input & local artifacts': '输入与本地产物',
  'One orchestrator with monitoring and five specialist subagents. Prompts are stored in the independent lai-agents plugin.': '一个具备监控能力的主 Agent 和五个子 Agent。提示词由独立的 lai-agents 插件管理。',
  'The lai-agents plugin is not enabled in this profile.': '当前 Profile 尚未启用 lai-agents 插件。',
  'Discard the draft and reload if settings changed elsewhere.': '如果设置已在其他位置修改，请放弃草稿并重新加载。',
  'Discard draft and reload': '放弃草稿并重新加载', 'Save prompts': '保存提示词', 'Prompts saved. Each role uses its updated prompt at the next prompt assembly.': '提示词已保存，下次拼装提示词时生效。',
  'Subagent tree canvas — drag to pan, scroll to zoom': '子 Agent 树：拖动平移、滚轮缩放', 'task': '任务', 'stage': '阶段',
  'tool calls · View turn': '次工具调用 · 查看 Turn', 'waiting for the first task event…': '等待任务事件…',
  'Retry': '重试', 'starting subagent…': '正在启动子 Agent…', 'tools': '个工具', 'tok': 'tok', 'no tool calls yet': '暂无工具调用', 'final message': '最终消息',
  'No delegations yet — subagent cards appear here when the orchestrator calls a delegation tool.': '暂无委派。主 Agent 调用委派工具后，子 Agent 卡片会显示在这里。', '· scroll to zoom': '· 滚轮缩放',
  'Model providers': '模型服务商', 'Connect a provider or your own API endpoint, then choose its models below.': '连接服务商或自定义 API，然后在下方选择模型。',
  'Add provider': '添加服务商', 'Loading providers…': '正在加载服务商…', 'This profile is read-only; provider changes are disabled.': '当前 Profile 为只读，无法修改服务商。',
  'Could not read API key status:': '无法读取 API Key 状态：', 'Configure': '配置', 'No providers configured. Add one to make models available.': '尚未配置服务商。添加服务商后即可选择模型。',
  'Provider': '服务商', 'Custom API / local server': '自定义 API / 本地服务', 'The provider adapter is not mounted in this profile.': '当前 Profile 未加载此服务商适配器。',
  'Provider ID': '服务商 ID', 'Display name': '显示名称', 'API endpoint': 'API 地址', 'API protocol': 'API 协议',
  'Use provider defaults': '使用服务商默认值', 'OpenAI compatible (Chat Completions)': 'OpenAI 兼容（Chat Completions）',
  'The built-in DeepSeek provider uses Anthropic Messages, not Chat Completions. Official endpoint:': '内置 DeepSeek 服务商使用 Anthropic Messages 协议，官方地址：',
  '. A custom OpenAI-compatible server needs a separate custom provider.': '。自定义 OpenAI 兼容服务需要另行添加服务商。',
  'API key': 'API Key', 'Keys are stored separately by DSH and never displayed here. Leaving this field blank keeps existing credentials. Local OpenAI-compatible servers may require a placeholder key.': '密钥由 DSH 独立保存，不会在此显示。留空将保留已有凭据。本地 OpenAI 兼容服务可能需要占位密钥。',
  'Credential status is unavailable.': '无法获取凭据状态。', 'This credential is read-only. Update it at its source.': '此凭据为只读，请在来源处更新。',
  'Models': '模型', 'Token limits are optional.': 'Token 限制可选。', 'Model ID': '模型 ID', 'Model name': '模型名称', 'Context window': '上下文窗口', 'Maximum output tokens': '最大输出 Token',
  'Remove model': '移除模型', 'Add model': '添加模型', 'If settings changed elsewhere, cancel and reopen this provider before saving again.': '如果设置已在其他位置修改，请取消并重新打开后再保存。',
  'Cancel': '取消', 'Run details': '执行详情', 'Runs list': '执行列表', 'No runs yet — start a task in DSH or trigger the pipeline': '暂无执行，请在 DSH 中启动任务或触发流水线。',
  'Follows the orchestrator route': '沿用主 Agent 的模型', 'Could not load configuration:': '无法加载配置：', 'Default model': '默认模型', 'live': '实时生效',
  'The route new agents use when no explicit model is pinned. Saved to the profile and applied without a restart.': '未固定模型时，新 Agent 使用此默认路由。保存到 Profile 后即时生效，无需重启。',
  'Provider · model': '服务商 · 模型', "DSH has not advertised any available models. Check the provider's API key and model list above.": 'DSH 尚未提供可用模型，请检查上方的 API Key 与模型列表。',
  'provider catalog': '服务商目录', 'failed to load:': '加载失败：', 'This profile is read-only; model changes are disabled.': '当前 Profile 为只读，无法修改模型。',
  'Pipeline agents': '流水线 Agents', 'presets ·': '个预设 ·', 'model': '模型', 'available': '可用',
  "Specialist agents inherit the orchestrator's model route unless their delegation tool pins an explicit": '专业子 Agent 默认继承主 Agent 的模型路由，除非委派工具显式配置了',
  'model in the composition. Applying a model here updates the shared default route that the pipeline follows; pinned routes are edited in the IQE composition overlay.': '模型。此处修改会更新流水线沿用的默认路由；固定路由需在组合配置中修改。',
  'loading…': '加载中…', 'refreshing live…': '实时更新中…', 'tool calls': '次工具调用', 'no events yet': '暂无事件', 'no result yet': '暂无结果', 'Final answer': '最终结果', 'no tasks match this filter': '没有符合筛选条件的任务',
  'running ·': '运行中 ·', 'All': '全部', 'Queued': '等待中', 'Apply': '应用', 'Save default': '保存默认值', 'Saving…': '保存中…', 'Refresh models': '刷新模型', 'Loading…': '加载中…',
  'Orchestrator': '主 Agent', 'Orchestrator / Monitor': '主 Agent / 监控', 'Triage': '根因分析', 'Reproduction': '复现', 'Ticket': '工单', 'Review': '审核', 'Reviewer': '审核', 'Reporter': '报告',
  'Find failures and regressions': '识别失败与回归', 'Monitor inputs and delegate tasks': '监控输入并调度任务', 'Classify root cause and evidence': '分析根因与证据', 'Run controlled local checks': '执行受控本地复现', 'Prepare an evidence-backed draft': '起草附带证据的工单', 'Independently validate the result': '独立审核结果', 'Consolidate findings and metrics': '汇总结果与指标',
  'LAI roles': 'LAI 角色', 'Event sources': '事件源', 'Waiting for an event': '等待事件', 'Starting…': '启动中…', 'Simulate CI failure': '模拟 CI 失败', 'Simulate commit': '模拟 Commit',
  'standby': '就绪', 'starting': '启动中', 'running': '运行中', 'completed': '已完成', 'failed': '失败', 'pending': '等待中', 'skipped': '已跳过', 'cancelled': '已取消', 'interrupted': '已中断', 'needs-review': '待审核', 'error': '错误',
  'timeline': '时间线', 'dag': 'DAG', 'result': '结果', 'Retry API key': '重试保存 API Key', 'Save provider': '保存服务商', 'Add model provider': '添加模型服务商',
  'Delete run': '删除 Run', 'Undo': '撤销', 'Run removed.': 'Run 已移除。', 'Deleting…': '删除中…', 'Stop the run before deleting it.': '请先停止执行再删除。', 'Move this run to the DSH archive. It can be restored with Undo or in the original DSH UI.': '将 Run 移入 DSH 归档，可撤销或在原版 DSH 界面恢复。',
}
const Context = createContext<{ language: Language; setLanguage: (language: Language) => void }>({ language: 'en', setLanguage: () => {} })
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => { try { return localStorage.getItem(KEY) === 'zh' ? 'zh' : 'en' } catch { return 'en' } })
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; try { localStorage.setItem(KEY, language) } catch { /* Private browsing can disable storage. */ } }, [language])
  return <Context.Provider value={{ language, setLanguage }}>{children}</Context.Provider>
}
export function useLanguage() {
  const state = useContext(Context)
  const t = (text: string): string => {
    if (state.language === 'en') return text
    const [, leading = '', core = text, trailing = ''] = text.match(/^(\s*)(.*?)(\s*)$/s) ?? []
    return leading + (ZH[core] ?? core) + trailing
  }
  return { ...state, t }
}
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()
  return <div className="flex items-center rounded-md border border-fd-border p-0.5 text-xs" role="group" aria-label="Language / 语言">
    {(['en', 'zh'] as const).map(value => <button type="button" key={value} aria-pressed={language === value} onClick={() => setLanguage(value)} className={`rounded px-2 py-1 transition-colors ${language === value ? 'bg-fd-secondary font-medium text-fd-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground'}`}>{value === 'en' ? 'EN' : '中文'}</button>)}
  </div>
}
