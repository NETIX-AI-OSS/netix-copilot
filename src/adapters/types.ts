// The host adapter contract.
//
// Nothing in this package reaches into an application. Every capability that differs between
// viz-ui and cafm-v2-ui is injected here instead: data fetching stays inside the SDK, but page
// context, chart rendering, permissions, translation and theme all come from the host.
//
// The deliberate omissions matter as much as the inclusions. There is no data-layer adapter
// because the SDK owns its own fetch, so neither SWR nor react-query is a dependency. There is
// no chart library adapter beyond a render callback, so ECharts is never bundled: each app keeps
// its own themed wrapper and the SDK just hands it option JSON.

import type { ReactNode } from 'react'

import type { CopilotChart, JsonObject } from '../types'

export interface CopilotUser {
  id: number
  organizationId: number
  name?: string
  email?: string
}

// One normalized description of "where the user is", assembled by the host from its router,
// its store and its session. The SDK sends it to the backend as opaque scope and uses a few
// fields for display only.
export interface CopilotPageContext {
  // Stable app identifier, for example 'viz-ui'. Sent with the scope so the backend can tell
  // which surface asked.
  app: string
  route: string
  routeParams?: Record<string, string>
  searchParams?: Record<string, string>
  user: CopilotUser
  // The primary record on screen, when there is one.
  entity?: { type: string; id: string | number; label?: string }
  // Anything else the host wants the model to know, straight from its own store.
  state?: JsonObject
}

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

// What the backend receives and what the user reads, when a host needs them to differ.
// cafm-v2-ui has to append `WORK_ORDER_ID: 4242` to the prompt because the agentic contract has
// no scope field, and that suffix must not appear in the user's own chat bubble.
export interface CopilotPrompt {
  wire: string
  // Defaults to the text the user typed, which stays authoritative for the transcript.
  display?: string
}

export interface CopilotPromptContext {
  pageContext: CopilotPageContext
  threadId?: string
  // True for the message that opens a thread. Hosts usually scope only that one, because a
  // reply lands on the same backend row and inherits whatever scope opened it.
  isFirstMessage: boolean
  // False when the user switched the composer's page-context chip off for this send. Absent
  // means included, so a host transform written before the chip existed keeps its behaviour.
  includeContext?: boolean
}

// Returning a bare string rewrites the wire text and leaves the display text alone.
export type CopilotPromptTransform = (
  prompt: string,
  context: CopilotPromptContext,
) => string | CopilotPrompt

// Theme is passed as plain tokens and applied as CSS custom properties, so the SDK works
// identically under Tailwind 3 (viz-ui, cafm-v2-ui) and Tailwind 4 (prism-ui) and needs no
// stylesheet import in the host. Every token has a default; a host sets what it has.
export interface CopilotThemeTokens {
  colorScheme?: 'light' | 'dark'
  // Surfaces: the card itself, then the two quieter fills used inside it (trace card, composer
  // box, chips). `surfaceMuted` is the older name for `surface2` and still applies.
  surface?: string
  surfaceMuted?: string
  surface2?: string
  surface3?: string
  border?: string
  borderStrong?: string
  text?: string
  textMuted?: string
  textTertiary?: string
  accent?: string
  accentText?: string
  accentSubtle?: string
  // The CAFM AI lane colour on agent cards; NETIX.AI lanes use the accent.
  domainCafm?: string
  danger?: string
  success?: string
  warning?: string
  // `radius` remains the card radius; the finer scale is for controls, chips and rows.
  radius?: string
  radiusSm?: string
  radiusMd?: string
  radiusLg?: string
  radiusPill?: string
  fontFamily?: string
  monoFontFamily?: string
  // `shadow` remains the dock elevation; `elev1..3` are the finer scale (dark hosts pass inset
  // borders here instead of shadows, as the NETIX tokens do).
  shadow?: string
  elev1?: string
  elev2?: string
  elev3?: string
  focusRing?: string
  motionFast?: string
  motionBase?: string
}

export interface CopilotChartRenderContext {
  height: number
  streaming: boolean
}

export interface CopilotMarkdownRenderContext {
  // True while the text is still growing, so a host renderer can skip expensive work.
  streaming: boolean
}

export interface CopilotNotification {
  message: string
  tone?: 'info' | 'error'
  action?: { label: string; onSelect: () => void }
}

// Human labels for tool and specialist names, keyed by the raw ml-engine name
// ('data_query_retrieve', 'FacilitiesAgent' or 'call_facilities_agent'). Anything absent falls
// back to the `copilot.tool.*` / `copilot.agent.*` translation keys, then to a sentence-cased
// version of the raw name.
export interface CopilotLabels {
  tools?: Record<string, string>
  agents?: Record<string, string>
}

export interface CopilotAdapters {
  pageContext: CopilotPageContext
  // Reuse the host's themed ECharts wrapper. viz-ui exports a default ECharts component taking
  // `option`, cafm-v2-ui exports EChartComponent taking `chartConfig` and `height`; both are one
  // line of glue here, and neither shape leaks into this package.
  renderChart: (chart: CopilotChart, context: CopilotChartRenderContext) => ReactNode
  // Checked before the dock renders at all, and again before a run is sent.
  hasPermission: (codename: string) => boolean
  t: TranslateFn
  theme: CopilotThemeTokens
  // Optional override. Without it the SDK uses its own streaming-tolerant markdown renderer,
  // which keeps react-markdown out of the dependency tree.
  renderMarkdown?: (markdown: string, context: CopilotMarkdownRenderContext) => ReactNode
  // Last chance to change what goes on the wire. The transcript keeps what the user typed.
  transformPrompt?: CopilotPromptTransform
  // Called when the assistant offers a link into the host app.
  onNavigate?: (href: string) => void
  // Route the SDK's small confirmations (copied, exported, deleted) through the host's toaster.
  // Without it the SDK shows its own bottom-centre pill.
  notify?: (notification: CopilotNotification) => void
  labels?: CopilotLabels
  // Starter prompts for an empty conversation, when the host does not pass them per panel.
  quickPrompts?: readonly string[]
  logger?: {
    warn: (message: string, detail?: unknown) => void
    error: (message: string, detail?: unknown) => void
  }
}

// Split one typed prompt into the text to display and the text to send. Always trims, and never
// lets a transform blank the transcript: an empty display falls back to what the user typed.
export function resolveCopilotPrompt(
  prompt: string,
  transform: CopilotPromptTransform | undefined,
  context: CopilotPromptContext,
): { display: string; wire: string } {
  const trimmed = prompt.trim()
  if (transform === undefined || trimmed === '') return { display: trimmed, wire: trimmed }
  const result = transform(trimmed, context)
  if (typeof result === 'string') {
    const wire = result.trim()
    return { display: trimmed, wire: wire === '' ? trimmed : wire }
  }
  const wire = result.wire.trim()
  const display = (result.display ?? trimmed).trim()
  return {
    display: display === '' ? trimmed : display,
    wire: wire === '' ? trimmed : wire,
  }
}

// Turn the host page context into the opaque scope object sent with each turn.
export function buildScope(pageContext: CopilotPageContext): JsonObject {
  const scope: JsonObject = {
    app: pageContext.app,
    route: pageContext.route,
    organization_id: pageContext.user.organizationId,
    user_id: pageContext.user.id,
  }
  if (pageContext.routeParams && Object.keys(pageContext.routeParams).length > 0) {
    scope.route_params = pageContext.routeParams
  }
  if (pageContext.searchParams && Object.keys(pageContext.searchParams).length > 0) {
    scope.search_params = pageContext.searchParams
  }
  if (pageContext.entity) {
    scope.entity = {
      type: pageContext.entity.type,
      id: String(pageContext.entity.id),
      ...(pageContext.entity.label === undefined ? {} : { label: pageContext.entity.label }),
    }
  }
  if (pageContext.state) scope.state = pageContext.state
  return scope
}
