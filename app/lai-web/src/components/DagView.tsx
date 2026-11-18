import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { PageResponse, SessionListEntry, WireEvent } from '../api/gateway.ts'
import { pageSubagentSession } from '../api/gateway.ts'
import { useInterval } from '../hooks/useInterval.ts'
import type { ChildModel, Delegation, TreeChild } from '../model/tree.ts'
import {
  deriveTree,
  formatDuration,
  formatTokens,
  summarizeChild,
} from '../model/tree.ts'
import type { SvgEdge } from '../model/tree.ts'

interface Controls {
  layout: 'horizontal' | 'vertical'
  density: 'compact' | 'comfortable'
  edges: 'curved' | 'elbow'
  showTools: boolean
  showPreviews: boolean
  motion: boolean
  grid: boolean
}

const DEFAULT_CONTROLS: Controls = {
  layout: 'horizontal',
  density: 'compact',
  edges: 'curved',
  showTools: true,
  showPreviews: false,
  motion: true,
  grid: false,
}

const GEO = {
  compact: { rootW: 216, childW: 250, gap: 84, nodeGap: 8, pad: 20 },
  comfortable: { rootW: 260, childW: 296, gap: 116, nodeGap: 12, pad: 28 },
} as const


interface ChildPage {
  state: 'loading' | 'ok' | 'error'
  records: WireEvent[]
  error?: string
}

interface RenderChild {
  key: string
  kind: 'child' | 'pending'
  sessionId: string | null
  delegation: Delegation | null
  stage: number
  hue: string
  running: boolean
  child: TreeChild | null
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface LayoutState {
  tops: Record<string, number | undefined>
  boxes: Record<string, Box | undefined>
  edges: (SvgEdge & { id: string })[]
  width: number
  height: number
  rootHeight: number
}

const EMPTY_LAYOUT: LayoutState = { tops: {}, boxes: {}, edges: [], width: 0, height: 0, rootHeight: 0 }

function positionIn(el: HTMLElement, root: HTMLElement): { x: number; y: number } {
  let x = 0
  let y = 0
  let node: HTMLElement | null = el
  while (node !== null && node !== root) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { x, y }
}

function edgePath(ax: number, ay: number, cx: number, cy: number, style: Controls['edges'], vertical: boolean): string {
  if (style === 'curved') {
    if (vertical) {
      const bend = Math.max(24, (cy - ay) * 0.5)
      return `M ${ax} ${ay} C ${ax} ${ay + bend}, ${cx} ${cy - bend}, ${cx} ${cy}`
    }
    const bend = Math.max(24, (cx - ax) * 0.5)
    return `M ${ax} ${ay} C ${ax + bend} ${ay}, ${cx - bend} ${cy}, ${cx} ${cy}`
  }
  const radius = 10
  if (vertical) {
    const midY = (ay + cy) / 2
    if (Math.abs(cx - ax) < 2) return `M ${ax} ${ay} L ${cx} ${cy}`
    const dir = cx > ax ? 1 : -1
    const r = Math.min(radius, Math.abs(cx - ax) / 2, Math.abs(cy - ay) / 4)
    return `M ${ax} ${ay} L ${ax} ${midY - r} Q ${ax} ${midY} ${ax + dir * r} ${midY} L ${cx - dir * r} ${midY} Q ${cx} ${midY} ${cx} ${midY + r} L ${cx} ${cy}`
  }
  const midX = (ax + cx) / 2
  if (Math.abs(cy - ay) < 2) return `M ${ax} ${ay} L ${cx} ${cy}`
  const dir = cy > ay ? 1 : -1
  const r = Math.min(radius, Math.abs(cy - ay) / 2, Math.abs(cx - ax) / 4)
  return `M ${ax} ${ay} L ${midX - r} ${ay} Q ${midX} ${ay} ${midX} ${ay + dir * r} L ${midX} ${cy - dir * r} Q ${midX} ${cy} ${midX + r} ${cy} L ${cx} ${cy}`
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour12: false })
}

export function DagView(props: { page: PageResponse; sessionId: string; running: boolean; entries: SessionListEntry[] }) {
  const { page, sessionId, running, entries } = props
  const controls = DEFAULT_CONTROLS
  const [childPages, setChildPages] = useState<Record<string, ChildPage | undefined>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean | undefined>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState({ x: 28, y: 28, scale: 1 })
  const [autoFit, setAutoFit] = useState(true)
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  const [layout, setLayout] = useState<LayoutState>(EMPTY_LAYOUT)
  const [toast, setToast] = useState<string | null>(null)
  const [measureTick, setMeasureTick] = useState(0)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const rootColRef = useRef<HTMLDivElement | null>(null)
  const nodeRefs = useRef(new Map<string, HTMLElement>())
  const inflight = useRef(new Set<string>())
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const dragState = useRef<{ moved: boolean; lastX: number; lastY: number; pinchDist: number } | null>(null)

  const geo = GEO[controls.density]
  const vertical = controls.layout === 'vertical'

  const loadChild = useCallback(async (childId: string): Promise<void> => {
    if (inflight.current.has(childId)) return
    inflight.current.add(childId)
    setChildPages(prev => prev[childId] === undefined ? { ...prev, [childId]: { state: 'loading', records: [] } } : prev)
    try {
      const result = await pageSubagentSession(sessionId, childId, 200)
      setChildPages(prev => ({ ...prev, [childId]: { state: 'ok', records: result.records.map(record => record.event) } }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setChildPages(prev => ({ ...prev, [childId]: { state: 'error', records: prev[childId]?.records ?? [], error: message } }))
    } finally {
      inflight.current.delete(childId)
    }
  }, [sessionId])

  const models = useMemo(() => {
    const result: Record<string, ChildModel | undefined> = {}
    for (const entry of entries) {
      if (entry.parentSessionId !== sessionId) continue
      const childPage = childPages[entry.sessionId]
      if (childPage?.state === 'ok') result[entry.sessionId] = summarizeChild(childPage.records, entry)
    }
    return result
  }, [entries, sessionId, childPages])

  const childLabels = useMemo(() => {
    const labels: Record<string, string | null> = {}
    for (const [id, model] of Object.entries(models)) {
      if (model !== undefined) labels[id] = model.label
    }
    return labels
  }, [models])

  const tree = useMemo(() => deriveTree(page, entries, sessionId, childLabels), [page, entries, sessionId, childLabels])

  const renderChildren = useMemo<RenderChild[]>(() => {
    const items: RenderChild[] = tree.children.map(child => ({
      key: child.sessionId,
      kind: 'child',
      sessionId: child.sessionId,
      delegation: child.delegation,
      stage: child.stage,
      hue: child.hue,
      running: child.running,
      child,
    }))
    for (const delegation of tree.delegations) {
      if (tree.children.some(child => child.delegation?.id === delegation.id)) continue
      if (delegation.settled !== null || delegation.receiptError !== null) continue
      items.push({
        key: `pending:${delegation.id}`,
        kind: 'pending',
        sessionId: null,
        delegation,
        stage: delegation.stage,
        hue: delegation.hue,
        running: true,
        child: null,
      })
    }
    return items.sort((a, b) => a.stage - b.stage)
  }, [tree])

  // Fetch each child once; keep polling while the tree is live.
  useEffect(() => {
    for (const child of renderChildren) {
      if (child.sessionId !== null && childPages[child.sessionId] === undefined) void loadChild(child.sessionId)
    }
  }, [renderChildren, childPages, loadChild])

  const anyChildRunning = renderChildren.some(child => child.running)
  useInterval(() => {
    for (const child of renderChildren) {
      if (child.sessionId === null) continue
      const entry = entries.find(candidate => candidate.sessionId === child.sessionId)
      if (entry?.running === true || childPages[child.sessionId] === undefined) void loadChild(child.sessionId)
    }
  }, running || anyChildRunning ? 2000 : null)

  useEffect(() => {
    if (running) return
    for (const child of renderChildren) {
      if (child.sessionId !== null) void loadChild(child.sessionId)
    }
    // One settle refetch when the task stops; loadChild dedupes in-flight work.
  }, [running])

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => { setToast(null) }, 2600)
    return () => { clearTimeout(timer) }
  }, [toast])


  const registerNode = useCallback((key: string) => (el: HTMLElement | null) => {
    if (el === null) nodeRefs.current.delete(key)
    else nodeRefs.current.set(key, el)
  }, [])

  // Measure pass: align children to their delegation anchors, then draw edges in layout coordinates.
  useLayoutEffect(() => {
    const content = contentRef.current
    const rootCol = rootColRef.current
    if (content === null || rootCol === null) return
    const measure = (): void => {
      const boxes: Record<string, Box> = {}
      for (const [key, el] of nodeRefs.current) {
        const pos = positionIn(el, content)
        boxes[key] = { x: pos.x, y: pos.y, w: el.offsetWidth, h: el.offsetHeight }
      }
      const rootBox = positionIn(rootCol, content)
      const rootW = rootCol.offsetWidth
      const rootH = rootCol.offsetHeight
      const tops: Record<string, number> = {}
      const edges: (SvgEdge & { id: string })[] = []
      let cursor = 0
      let maxChildExtent = 0
      for (const child of renderChildren) {
        const el = nodeRefs.current.get(child.key)
        if (el === undefined) continue
        const size = vertical ? el.offsetWidth : el.offsetHeight
        const anchor = child.delegation !== null ? nodeRefs.current.get(tree.steps.find(step => step.tools.some(tool => tool.delegationId === child.delegation?.id))?.id ?? '') : nodeRefs.current.get('task')
        let center = cursor + size / 2
        if (anchor !== undefined) {
          const anchorPos = positionIn(anchor, content)
          const anchorCenter = vertical
            ? anchorPos.x + anchor.offsetWidth / 2 - rootBox.x
            : anchorPos.y + anchor.offsetHeight / 2 - rootBox.y
          center = anchorCenter
        }
        const start = Math.max(center - size / 2, cursor, 0)
        tops[child.key] = start
        cursor = start + size + geo.nodeGap
        maxChildExtent = Math.max(maxChildExtent, start + size)
        if (anchor !== undefined) {
          const anchorPos = positionIn(anchor, content)
          const childPos = vertical
            ? { x: geo.pad + start, y: geo.pad + rootH + geo.gap }
            : { x: geo.pad + rootW + geo.gap, y: geo.pad + start }
          const ax = vertical ? anchorPos.x + anchor.offsetWidth / 2 : anchorPos.x + anchor.offsetWidth
          const ay = vertical ? anchorPos.y + anchor.offsetHeight : anchorPos.y + anchor.offsetHeight / 2
          const cx = vertical ? childPos.x + el.offsetWidth / 2 : childPos.x
          const cy = vertical ? childPos.y : childPos.y + el.offsetHeight / 2
          const active = child.running
          edges.push({ id: child.key, d: edgePath(ax, ay, cx, cy, controls.edges, vertical), hue: child.hue, active })
        }
      }
      const width = vertical
        ? Math.max(rootW, maxChildExtent) + geo.pad * 2
        : rootW + geo.gap + geo.childW + geo.pad * 2
      const height = vertical
        ? rootH + geo.gap + maxChildExtent + geo.pad * 2
        : Math.max(rootH, maxChildExtent) + geo.pad * 2
      const next: LayoutState = { tops, boxes, edges, width, height, rootHeight: rootH }
      setLayout(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next)
    }
    measure()
    const observer = new ResizeObserver(() => { setMeasureTick(tick => tick + 1) })
    observer.observe(content)
    observer.observe(rootCol)
    return () => { observer.disconnect() }
  }, [renderChildren, geo, vertical, controls.edges, controls.showTools, controls.showPreviews, expanded, childPages, measureTick, page])

  // Auto-fit keeps the whole tree inside the viewport: refit whenever the graph
  // or the viewport changes size, until the user pans or zooms manually.
  const fitView = useCallback((): void => {
    const viewport = viewportRef.current
    if (viewport === null || layout.width === 0 || layout.height === 0) return
    const fitWidth = (viewport.clientWidth - 32) / layout.width
    const fitHeight = (viewport.clientHeight - 32) / layout.height
    const scale = Math.min(1.4, Math.max(0.02, Math.min(fitWidth, fitHeight)))
    setView({
      scale,
      x: (viewport.clientWidth - layout.width * scale) / 2,
      y: (viewport.clientHeight - layout.height * scale) / 2,
    })
  }, [layout.width, layout.height])

  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const observer = new ResizeObserver(() => {
      setViewportSize(prev => prev.w === viewport.clientWidth && prev.h === viewport.clientHeight
        ? prev
        : { w: viewport.clientWidth, h: viewport.clientHeight })
    })
    observer.observe(viewport)
    return () => { observer.disconnect() }
  }, [])

  useEffect(() => {
    if (autoFit) fitView()
  }, [autoFit, fitView, viewportSize])

  // Screen resizing is the primary auto-fit trigger; ResizeObserver also covers
  // container reflows that do not change the window size.
  useEffect(() => {
    const onResize = (): void => { if (autoFit) fitView() }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize) }
  }, [autoFit, fitView])

  const zoomBy = useCallback((factor: number, originX?: number, originY?: number): void => {
    const viewport = viewportRef.current
    if (viewport === null) return
    setAutoFit(false)
    const cx = originX ?? viewport.clientWidth / 2
    const cy = originY ?? viewport.clientHeight / 2
    setView((prev) => {
      const scale = Math.min(2.5, Math.max(0.02, prev.scale * factor))
      const ratio = scale / prev.scale
      return { scale, x: cx - (cx - prev.x) * ratio, y: cy - (cy - prev.y) * ratio }
    })
  }, [])

  // Wheel zoom needs a non-passive listener; React root wheel listeners are passive.
  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      zoomBy(Math.exp(-event.deltaY * 0.0016), event.clientX - rect.left, event.clientY - rect.top)
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => { viewport.removeEventListener('wheel', onWheel) }
  }, [zoomBy])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if ((event.target as Element).closest('[data-node]') !== null) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    dragState.current = { moved: false, lastX: event.clientX, lastY: event.clientY, pinchDist: 0 }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = dragState.current
    const previous = pointers.current.get(event.pointerId)
    if (state === null || previous === undefined) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()]
      const dist = Math.hypot(first.x - second.x, first.y - second.y)
      if (state.pinchDist > 0 && dist > 0) {
        const rect = event.currentTarget.getBoundingClientRect()
        zoomBy(dist / state.pinchDist, (first.x + second.x) / 2 - rect.left, (first.y + second.y) / 2 - rect.top)
      }
      state.pinchDist = dist
      state.moved = true
      return
    }
    const dx = event.clientX - previous.x
    const dy = event.clientY - previous.y
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      state.moved = true
      setAutoFit(false)
    }
    state.lastX = event.clientX
    state.lastY = event.clientY
    setView(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size === 0) {
      if (dragState.current?.moved === false) setSelected(null)
      dragState.current = null
    }
  }

  const focusChild = (key: string): void => {
    setSelected(key)
    const box = layout.boxes[key]
    const viewport = viewportRef.current
    if (box === undefined || viewport === null) return
    setAutoFit(false)
    setView(prev => ({
      ...prev,
      x: viewport.clientWidth / 2 - (box.x + box.w / 2) * prev.scale,
      y: viewport.clientHeight / 2 - (box.y + box.h / 2) * prev.scale,
    }))
  }

  const visibleSteps = useMemo(() => tree.steps.filter(step =>
    step.kind === 'turn' || step.delegationId !== null || controls.showTools), [tree.steps, controls.showTools])

  const layoutReady = renderChildren.every(child => layout.tops[child.key] !== undefined)
  const statusOf = (child: RenderChild): 'running' | 'completed' | 'failed' => {
    const model = child.sessionId !== null ? models[child.sessionId] : undefined
    if (model !== undefined) return model.status
    // Until the child page lands, only a fetch failure is knowable; otherwise show live progress.
    return child.sessionId !== null && childPages[child.sessionId]?.state === 'error' ? 'failed' : 'running'
  }

  return (
    <div className="flex h-full flex-col">
      <div
        aria-label="Subagent tree canvas — drag to pan, scroll to zoom"
        className={`relative min-h-0 flex-1 overflow-hidden ${controls.grid ? 'fd-grid' : ''} fd-canvas`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        ref={viewportRef}
        role="application"
        style={{ cursor: dragState.current !== null ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <div className="fd-vignette pointer-events-none absolute inset-0" />
        <div
          ref={contentRef}
          style={{
            // flow-root establishes a BFC so the root column's top margin stays inside
            // the measured content box instead of collapsing out of it.
            display: 'flow-root',
            position: 'relative',
            width: layout.width === 0 ? undefined : layout.width,
            height: layout.height === 0 ? undefined : layout.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: '0 0',
          }}
        >
          <svg
            className="pointer-events-none absolute left-0 top-0"
            height={Math.max(layout.height, 1)}
            style={{ overflow: 'visible' }}
            width={Math.max(layout.width, 1)}
          >
            {layout.edges.map(edge => (
              <g key={edge.id}>
                <path
                  className={edge.active && controls.motion ? 'fd-edge-active' : undefined}
                  d={edge.d}
                  fill="none"
                  opacity={selected === edge.id ? 1 : edge.active ? 0.9 : 0.5}
                  stroke={edge.hue}
                  strokeDasharray={edge.active && !controls.motion ? '6 5' : undefined}
                  strokeWidth={selected === edge.id ? 2.6 : 1.6}
                />
                <circle cx={endPoint(edge.d).x} cy={endPoint(edge.d).y} fill={edge.hue} r={3.2} />
              </g>
            ))}
          </svg>

          <div
            className={vertical ? 'flex flex-row items-start' : 'flex flex-col'}
            ref={rootColRef}
            style={{
              gap: geo.nodeGap,
              marginLeft: geo.pad,
              marginTop: geo.pad,
              // max-content keeps the horizontal root row at its intrinsic width so the
              // measured rootW reflects the full row instead of a shrunk flex container.
              width: vertical ? 'max-content' : geo.rootW,
            }}
          >
            {tree.task !== null && (
              <div
                className="fd-node rounded-lg border border-fd-primary/40 bg-fd-card p-3"
                data-node
                ref={registerNode('task')}
                style={{ width: vertical ? geo.rootW : undefined }}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-fd-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fd-primary">task</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{tree.task.taskId}</span>
                  <span className="shrink-0 font-mono text-[10px] text-fd-muted-foreground">{formatTime(tree.task.time)}</span>
                </div>
                {controls.showPreviews && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-fd-muted-foreground">{tree.task.prompt}</p>}
              </div>
            )}
            {visibleSteps.map((step) => {
              const delegation = step.delegationId !== null
                ? tree.delegations.find(candidate => candidate.id === step.delegationId)
                : undefined
              if (delegation !== undefined) {
                const child = renderChildren.find(candidate => candidate.delegation?.id === delegation.id)
                return (
                  <button
                    className="fd-node rounded-lg border bg-fd-card p-2.5 text-left transition-colors hover:bg-fd-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-fd-primary"
                    data-node
                    key={step.id}
                    onClick={() => { if (child !== undefined) focusChild(child.key) }}
                    ref={registerNode(step.id)}
                    style={{ borderColor: `color-mix(in srgb, ${delegation.hue} 40%, transparent)`, borderLeft: `3px solid ${delegation.hue}`, width: vertical ? geo.rootW : undefined }}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ background: `color-mix(in srgb, ${delegation.hue} 12%, transparent)`, color: delegation.hue }}>
                        stage {delegation.stage}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{delegation.toolName}</span>
                      <StatusDot status={delegation.receiptError !== null ? 'failed' : child !== undefined ? statusOf(child) : 'running'} motion={controls.motion} />
                    </div>
                    <div className="mt-1 truncate text-xs text-fd-muted-foreground">{delegation.description || delegation.name}</div>
                  </button>
                )
              }
              return (
                <div
                  className={`fd-node rounded-lg border bg-fd-card ${controls.density === 'compact' ? 'p-2' : 'p-2.5'} ${step.isError ? 'border-fd-danger/50' : 'border-fd-border'}`}
                  data-node
                  key={step.id}
                  ref={registerNode(step.id)}
                  style={{ width: vertical ? geo.rootW : undefined }}
                >
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${step.kind === 'turn' ? 'bg-fd-secondary text-fd-foreground' : step.isError ? 'bg-fd-danger/15 text-fd-danger' : 'bg-fd-warning/10 text-fd-warning'}`}>
                      {step.kind === 'turn' ? `turn ${step.turn}` : 'tool'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{step.label}</span>
                    <span className="shrink-0 font-mono text-[10px] text-fd-muted-foreground">{formatTime(step.time)}</span>
                  </div>
                  <details className="mt-2 text-xs" onToggle={() => setMeasureTick(tick => tick + 1)}>
                    <summary className="cursor-pointer text-fd-muted-foreground">{step.tools.length} tool calls · 查看 Turn</summary>
                    <div className="mt-2 space-y-2">
                      {step.tools.map(tool => <details key={tool.id} className="rounded border border-fd-border bg-fd-muted p-2" onToggle={() => setMeasureTick(tick => tick + 1)}>
                        <summary className={`cursor-pointer break-all font-mono text-[11px] ${tool.isError ? 'text-fd-danger' : 'text-fd-foreground'}`}>{tool.isError ? '✕' : '›'} {tool.name}</summary>
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] text-fd-muted-foreground">{tool.preview}</pre>
                        {tool.result && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px]">{tool.result}</pre>}
                      </details>)}
                      {step.preview && <p className="whitespace-pre-wrap break-words leading-relaxed text-fd-muted-foreground">{step.preview}</p>}
                    </div>
                  </details>
                </div>
              )
            })}
            {tree.task === null && visibleSteps.length === 0 && (
              <div className="rounded-lg border border-fd-border bg-fd-card p-3 text-xs text-fd-muted-foreground" style={{ width: geo.rootW }}>
                waiting for the first task event…
              </div>
            )}
          </div>

          {renderChildren.map((child) => {
            const model = child.sessionId !== null ? models[child.sessionId] : undefined
            const childPage = child.sessionId !== null ? childPages[child.sessionId] : undefined
            const status = statusOf(child)
            const isExpanded = expanded[child.key] ?? false
            const top = layout.tops[child.key] ?? 0
            const left = vertical ? geo.pad + top : geo.pad + geo.rootW + geo.gap
            const topPos = vertical ? geo.pad + layout.rootHeight + geo.gap : geo.pad + top
            return (
              <div
                className="fd-node absolute rounded-lg border bg-fd-card transition-opacity duration-150"
                data-node
                key={child.key}
                ref={registerNode(child.key)}
                style={{
                  borderColor: selected === child.key ? child.hue : `color-mix(in srgb, ${child.hue} 33%, transparent)`,
                  boxShadow: selected === child.key ? `0 0 0 1px ${child.hue}, 0 0 24px color-mix(in srgb, ${child.hue} 13%, transparent)` : undefined,
                  left,
                  opacity: layoutReady ? 1 : 0,
                  top: topPos,
                  width: geo.childW,
                }}
              >
                <button
                  aria-expanded={isExpanded}
                  className="w-full rounded-lg p-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-fd-primary"
                  onClick={() => { setExpanded(prev => ({ ...prev, [child.key]: !isExpanded })); setSelected(child.key) }}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium" style={{ background: `color-mix(in srgb, ${child.hue} 13%, transparent)`, color: child.hue }}>
                      {child.stage}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {model?.label ?? child.delegation?.description ?? child.delegation?.name ?? 'subagent'}
                    </span>
                    {(model !== undefined || child.kind === 'pending') && <StatusPill status={status} motion={controls.motion} />}
                    <svg aria-hidden className={`h-3 w-3 shrink-0 text-fd-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 12 12">
                      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                    <span className="rounded bg-fd-secondary px-1.5 py-0.5 font-mono text-fd-muted-foreground">{model?.preset ?? 'preset …'}</span>
                    {child.delegation !== null && <span className="truncate font-mono text-fd-muted-foreground">{child.delegation.name}</span>}
                  </div>
                  {childPage?.state === 'error' && (
                    <div className="mt-2 rounded-md border border-fd-danger/40 bg-fd-danger/10 p-2 text-xs text-fd-danger">
                      <span className="line-clamp-2">{childPage.error ?? 'child session unavailable'}</span>
                      <span
                        className="mt-1 inline-block cursor-pointer rounded border border-fd-danger/50 px-1.5 py-0.5 text-[10px] hover:bg-fd-danger/20"
                        onClick={(event) => { event.stopPropagation(); if (child.sessionId !== null) void loadChild(child.sessionId) }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => { if (event.key === 'Enter' && child.sessionId !== null) void loadChild(child.sessionId) }}
                      >
                        Retry
                      </span>
                    </div>
                  )}
                  {childPage?.state === 'loading' && child.kind === 'child' && (
                    <div className="mt-2 space-y-1.5">
                      <div className="fd-shimmer h-2.5 w-3/4 rounded" />
                      <div className="fd-shimmer h-2.5 w-1/2 rounded" />
                    </div>
                  )}
                  {child.kind === 'pending' && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-fd-muted-foreground">
                      <span className={`h-1.5 w-1.5 rounded-full bg-fd-warning ${controls.motion ? 'animate-pulse' : ''}`} />
                      starting subagent…
                    </div>
                  )}
                  {model !== undefined && (
                    <>
                      <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-fd-muted-foreground">
                        <span>{model.tools.length} tools{model.toolErrors > 0 ? ` · ${model.toolErrors} err` : ''}</span>
                        {model.tokens !== null && <span>{formatTokens(model.tokens)} tok</span>}
                        {model.durationMs !== null && <span>{formatDuration(model.durationMs)}</span>}
                      </div>
                      {controls.showPreviews && model.finalText !== '' && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fd-muted-foreground">{model.finalText}</p>
                      )}
                    </>
                  )}
                </button>
                {isExpanded && model !== undefined && (
                  <div className="border-t border-fd-border px-2.5 pb-2.5 pt-2">
                    {model.model !== null && <div className="mb-1.5 truncate font-mono text-[10px] text-fd-muted-foreground">{model.model}</div>}
                    <div className="fd-scroll max-h-44 space-y-1 overflow-y-auto pr-1">
                      {model.tools.map((tool, index) => (
                        <div className="rounded-md bg-fd-muted px-2 py-1" key={`${tool.name}-${index}`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] ${tool.isError ? 'text-fd-danger' : 'text-fd-success'}`}>{tool.isError ? '✕' : '✓'}</span>
                            <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{tool.name}</span>
                            <span className="shrink-0 font-mono text-[9px] text-fd-muted-foreground">{formatTime(tool.time)}</span>
                          </div>
                          {controls.showPreviews && tool.preview !== '' && <div className="mt-0.5 line-clamp-1 pl-4 text-[10px] text-fd-muted-foreground">{tool.preview}</div>}
                        </div>
                      ))}
                      {model.tools.length === 0 && <div className="py-1 text-xs text-fd-muted-foreground">no tool calls yet</div>}
                    </div>
                    {model.finalText !== '' && (
                      <div className="fd-scroll mt-2 max-h-36 overflow-y-auto rounded-md border border-fd-border bg-fd-muted p-2">
                        <div className="mb-1 text-[9px] uppercase tracking-wider text-fd-muted-foreground">final message</div>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed">{model.finalText}</p>
                      </div>
                    )}
                  </div>
                )}
                {isExpanded && model === undefined && child.kind === 'child' && (
                  <div className="border-t border-fd-border p-2.5 text-xs text-fd-muted-foreground">
                    {childPage?.state === 'error' ? 'fetch failed — use Retry above' : 'loading child session…'}
                  </div>
                )}
              </div>
            )
          })}

          {renderChildren.length === 0 && tree.delegations.length === 0 && (
            <div
              className="absolute rounded-lg border border-dashed border-fd-border bg-fd-card/60 p-4 text-xs text-fd-muted-foreground"
              style={{ left: geo.pad + geo.rootW + geo.gap, top: geo.pad, width: geo.childW }}
            >
              No delegations yet — subagent cards appear here when the orchestrator calls a delegation tool.
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-2 right-3 rounded bg-fd-card/80 px-2 py-1 font-mono text-[10px] text-fd-muted-foreground">
          {Math.round(view.scale * 100)}% · {autoFit ? 'auto-fit on' : 'drag to pan'} · scroll to zoom
        </div>
      </div>
    </div>
  )
}

function endPoint(d: string): { x: number; y: number } {
  const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  return { x: numbers.at(-2) ?? 0, y: numbers.at(-1) ?? 0 }
}

function StatusDot(props: { status: 'running' | 'completed' | 'failed'; motion: boolean }): ReactNode {
  const color = props.status === 'running' ? 'bg-fd-warning' : props.status === 'completed' ? 'bg-fd-success' : 'bg-fd-danger'
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color} ${props.status === 'running' && props.motion ? 'fd-pulse-ring' : ''}`} />
}

function StatusPill(props: { status: 'running' | 'completed' | 'failed'; motion: boolean }): ReactNode {
  const style = props.status === 'running'
    ? 'bg-fd-warning/15 text-fd-warning'
    : props.status === 'completed'
      ? 'bg-fd-success/15 text-fd-success'
      : 'bg-fd-danger/15 text-fd-danger'
  return (
    <span className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${style}`}>
      <span className={`h-1 w-1 rounded-full bg-current ${props.status === 'running' && props.motion ? 'animate-pulse' : ''}`} />
      {props.status}
    </span>
  )
}
