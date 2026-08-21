# netix-copilot

One persistent, streaming copilot dock for the NETIX front ends, replacing the per-app chat
drawers that were copy-pasted across viz-ui, cafm-v2-ui and their siblings.

The package owns the hard parts — the wire protocol, the SSE reader, run state, resume and the
chat surface — and takes everything application-specific through injected adapters. It depends on
neither SWR nor react-query, bundles no chart library, and imports no stylesheet.

## Install

```bash
pnpm add github:NETIX-AI-OSS/netix-copilot#v0.1.0
```

```jsonc
// package.json
"dependencies": {
  "netix-copilot": "github:NETIX-AI-OSS/netix-copilot#v0.1.0"
}
```

`react` and `react-dom` are peer dependencies (`>=18.2 <20`); the host already has them. The
package has **no runtime dependencies at all**, so installing it adds nothing to the host's
dependency graph beyond its own compiled output.

The built `dist/` is committed to the repository, exactly as `envoy-ts-auth` does it, so there is
no build step on install and no `prepare` script for pnpm to run.

## Quick start

Mount the provider and the dock once, at the application root and **outside the router outlet** —
that is what makes the dock persist across navigation.

```tsx
import { CopilotDock, CopilotProvider, createFallbackTranslate } from 'netix-copilot'

import ECharts from '@/dashboards/ui/charts/echarts'

function AppShell() {
  const { pathname } = useLocation()
  const user = useCurrentUser()

  return (
    <CopilotProvider
      config={{ baseUrl: import.meta.env.VITE_ML_ENGINE_BASE_URL, getAuthToken: () => auth.token }}
      adapters={{
        pageContext: {
          app: 'viz-ui',
          route: pathname,
          user: { id: user.id, organizationId: user.organizationId },
        },
        renderChart: (chart, ctx) => (
          <ECharts option={chart.option} style={{ height: ctx.height }} />
        ),
        hasPermission: (codename) => auth.permissions.has(codename),
        t: createFallbackTranslate(),
        theme: { colorScheme: 'light', accent: 'hsl(var(--primary))' },
      }}
    >
      <Routes>{/* … */}</Routes>
      <CopilotDock />
    </CopilotProvider>
  )
}
```

## Which backend it talks to

There are two wire protocols behind one event vocabulary, and the difference is not academic.

| Transport | Routes                                                                                                           | Status on 2026-08-21                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `agentic` | `POST /api/agentic-ml-request/`, `GET /api/agentic-ml-request/{id}/`, `POST /api/agentic-ml-request/{id}/reply/` | **Live.** This is what ml-engine serves and what every existing chat drawer already calls.                                                  |
| `sse`     | `POST /api/copilot/turns/`, `GET /api/copilot/turns/{id}/stream/`                                                | **Not deployed.** The streaming contract from the copilot blueprint. Implemented and tested here so the hosts need no change when it lands. |

`transport: 'auto'` (the default) probes the streaming create endpoint once, and on a 404/405/501
switches permanently to the agentic contract for the life of the tab. Pin it with
`transport: 'agentic'` to skip the probe entirely, or `'sse'` to require streaming.

The agentic transport polls the request resource and diffs successive snapshots into the same
events the stream will emit: `response_text` growth becomes `message_delta`, new `execution_log`
entries become `step_result`, `chart_config` becomes `chart`, and the integer `status` becomes
`queued` / `done` / `error` / `cancelled`. Nothing above the transport can tell them apart.

### Event vocabulary

`run_started` · `queued` · `plan` · `step_started` · `step_result` · `message_delta` · `chart` ·
`usage` · `done` · `error` · `cancelled`

`plan` is **optional**. ml-engine's direct router answers single-domain prompts without ever
consulting the orchestrator, so a perfectly healthy run may never emit one. Nothing blocks on it;
`RunState.hasPlan` records whether it arrived and the timeline renders from whatever steps exist.

## The adapter contract

Everything that differs between applications is injected. Everything that does not is owned here.

| Adapter                | Type                        | Why the host supplies it                                                                                                                                            |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pageContext`          | `CopilotPageContext`        | The host normalizes route params, search params, store state and the current user into one scope object. `buildScope()` serializes it onto every turn.              |
| `renderChart`          | `(chart, ctx) => ReactNode` | Each app has its own themed ECharts wrapper. The SDK passes raw option JSON and never imports ECharts.                                                              |
| `hasPermission`        | `(codename) => boolean`     | Gates the whole surface. Defaults to checking `ai-assistant-view`.                                                                                                  |
| `t`                    | `(key, vars?) => string`    | Every visible string goes through it. `COPILOT_STRINGS` lists the keys; `createFallbackTranslate()` is a working default.                                           |
| `theme`                | `CopilotThemeTokens`        | Applied as CSS custom properties, so the dock restyles without a stylesheet import and without caring that viz-ui is on Tailwind 3 while prism-ui is on Tailwind 4. |
| `renderMarkdown`       | optional                    | Override the built-in renderer. Omit it and the SDK uses its own streaming-tolerant one, which keeps `react-markdown` out of the dependency tree.                   |
| `onNavigate`, `logger` | optional                    | Deep links and diagnostics.                                                                                                                                         |

There is deliberately **no data-layer adapter**. The SDK owns its own `fetch`, so it behaves
identically in viz-ui (SWR) and cafm-v2-ui (react-query).

## Connection behaviour

- **An idle dock holds no connection.** A stream opens in `send()` and nowhere else; mounting the
  dock only registers a store listener. ml-engine runs one replica with two uvicorn workers and
  the shared ingress caps concurrent connections per IP across all eleven API hosts, so a
  permanently connected dock on every tab would not survive a busy office.
- **StrictMode-safe.** State lives outside React and is read through `useSyncExternalStore`, so a
  double mount adds and removes a listener and touches nothing else. Teardown after the last
  unmount is deferred by a grace period (`teardownGraceMs`, default 250 ms) so StrictMode's
  unmount/remount cycle cannot kill a live run.
- **Resume, not replay.** The last event id is tracked and sent as `Last-Event-ID` when a dropped
  socket is reconnected. The agentic transport encodes an equivalent cursor describing how much of
  the snapshot has already been rendered, so a resume never repeats the answer.
- **Offline pauses.** Losing the network suspends the reader and marks the run `paused` rather
  than failing it; regaining it resumes from the cursor.
- **No `EventSource`.** Native `EventSource` cannot set an `Authorization` header and the
  gateway's ext_authz filter reads only that header, with no cookie fallback. The SDK uses
  `fetch()` with a hand-written `ReadableStream` SSE parser.

## Stacking, and the z-index that is not 100

Measured in the host apps rather than assumed:

- The toaster actually mounted in viz-ui, cafm-v2-ui and prism-ui is **sonner**, which hard-codes
  `z-index: 999999999` on `[data-sonner-toaster]`. Neither app overrides it.
- The familiar `z-[100]` belongs to the Radix `ToastViewport` in viz-ui's
  `components/ui/toast.tsx`, which is only referenced by `ui/toaster.tsx` — a component no app
  mounts. It is not the ceiling it looks like.
- viz-ui's own dashboard chrome is the real competition: `spatial-widget.tsx` paints at
  `z-[40000]` and `z-[30000]`. cafm-v2-ui tops out at `z-[100]`.

So the dock occupies a **60000 band** — clear of viz-ui's 40000, far below sonner so a toast stays
readable over an open dock:

```
dock 60000 · launcher 60010 · popover 60020 · overlay 60030
```

Exported as `COPILOT_Z_INDEX`, with the measured competition in `COPILOT_Z_INDEX_NOTES`. The
internal ordering mirrors the AI concierge prototype in `frontend/customer-v2/mock`, rebased out
of its self-contained 50–160 range. The dock also portals into `document.body`, because a
transformed ancestor in the host layout creates a stacking context that no z-index escapes.

## Development

```bash
pnpm install
pnpm build          # tsc -> dist/ (committed)
pnpm test           # vitest
pnpm test:coverage
pnpm lint
pnpm format
```

## Releasing

The build output is committed, so a release is: build, commit, tag, push.

```bash
pnpm install
pnpm lint && pnpm format:check && pnpm test && pnpm build
git add -A dist
git commit -m "release: v0.2.0"
git tag v0.2.0          # lightweight. NEVER -a, NEVER -s
git push origin main
git push origin v0.2.0
```

### Tags must be lightweight

**Use `git tag vX.Y.Z`. Never `git tag -a` and never `git tag -s`.**

An annotated tag is its own Git object, and pnpm resolves a `github:` dependency by pinning the
SHA the ref points at — which for an annotated tag is the tag object, not the commit it wraps.
The initial install succeeds because the tarball fetch follows the ref, but every later
re-resolve looks up a SHA that is not a commit and fails with `ERR_PNPM_GIT_CHECKOUT_FAILED`.
This fleet has already been bitten by it: `envoy-ts-auth@v1.2.0` is annotated, and v1.3.0 and
v1.4.0 are lightweight because of it.

Check before pushing — the answer must be `commit`, not `tag`:

```bash
git cat-file -t v0.2.0
```

Because pnpm pins a resolved SHA, a tag must also be treated as immutable. Moving one strands
every lockfile that already resolved it; ship a new version instead.

### Consumer notes

- Consumers run pnpm 10.28.1, 10.33.4, 11.1.1 and 11.8.0. This package targets the lowest: no
  lifecycle scripts, no workspace protocol, no runtime dependencies.
- On pnpm 11 the `pnpm` field in `package.json` is ignored; overrides belong in
  `pnpm-workspace.yaml`. That is where this repo keeps its own.
- pnpm 11's 24h `minimumReleaseAge` applies to registry packages, not to `github:` refs, so a
  fresh tag is installable immediately.

## Governance

- [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) ·
  [`SECURITY.md`](SECURITY.md) · [`CHANGELOG.md`](CHANGELOG.md)

## License

GNU Affero General Public License v3.0 only. See [`LICENSE`](LICENSE).
