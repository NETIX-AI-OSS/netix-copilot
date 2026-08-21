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
}

// Returning a bare string rewrites the wire text and leaves the display text alone.
export type CopilotPromptTransform = (
  prompt: string,
  context: CopilotPromptContext,
) => string | CopilotPrompt

// Theme is passed as plain tokens and applied as CSS custom properties, so the SDK works
// identically under Tailwind 3 (viz-ui, cafm-v2-ui) and Tailwind 4 (prism-ui) and needs no
// stylesheet import in the host.
export interface CopilotThemeTokens {
  colorScheme?: 'light' | 'dark'
  surface?: string
  surfaceMuted?: string
  border?: string
  text?: string
  textMuted?: string
  accent?: string
  accentText?: string
  danger?: string
  success?: string
  warning?: string
  radius?: string
  fontFamily?: string
  monoFontFamily?: string
  shadow?: string
}

export interface CopilotChartRenderContext {
  height: number
  streaming: boolean
}

export interface CopilotMarkdownRenderContext {
  // True while the text is still growing, so a host renderer can skip expensive work.
  streaming: boolean
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
