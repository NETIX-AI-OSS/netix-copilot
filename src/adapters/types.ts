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
  // Called when the assistant offers a link into the host app.
  onNavigate?: (href: string) => void
  logger?: {
    warn: (message: string, detail?: unknown) => void
    error: (message: string, detail?: unknown) => void
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
