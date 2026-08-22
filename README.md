# netix-copilot

One persistent, streaming copilot dock for the NETIX front ends, replacing the per-app chat
drawers that were copy-pasted across viz-ui, cafm-v2-ui and their siblings.

The package owns the hard parts — the wire protocol, the SSE reader, run state, resume and the
chat surface — and takes everything application-specific through injected adapters. It depends on
neither SWR nor react-query, bundles no chart library, and imports no stylesheet.

## Install

```bash
pnpm add github:NETIX-AI-OSS/netix-copilot#v0.2.0
```

```jsonc
// package.json
"dependencies": {
  "netix-copilot": "github:NETIX-AI-OSS/netix-copilot#v0.2.0"
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

### Opening the dock from the host

`CopilotDock` is uncontrolled by default and remembers whether it was open. Supply `open` and the
host owns the state instead — which is what a URL contract, a topbar button or a deep link needs.

```tsx
const [params, setParams] = useSearchParams()
const open = params.get('ai_open') === '1'

<CopilotDock
  open={open}
  onOpenChange={(next) => {
    setParams((current) => {
      if (next) current.set('ai_open', '1')
      else current.delete('ai_open')
      return current
    })
  }}
  showLauncher={false}
/>
```

Precedence is: a supplied `open` prop, then the stored value, then `defaultOpen`, then closed.
While `open` is supplied nothing is read from or written to localStorage, so the host's value is
never overwritten by a stale one.

To restore a conversation from a `?thread=<id>` link, point the engine at it:

```tsx
useEffect(() => {
  if (threadId) engine.selectThread(threadId)
}, [engine, threadId])
```

`selectThread` fetches the thread and rebuilds its turns — plan, charts, result tables, tools and
timing included — so a replayed answer renders through the same components as a live one. Use
`engine.loadThread(id)` when you need to await it, and `state.threadLoading` while it is in flight.

### Scoping a prompt without showing the scope

Neither wire contract has a scope field — `CopilotAskSerializer` reads `prompt`, `thread_id` and
`max_tokens` and nothing else — so a host that needs the model to see its page context puts that
context in the prompt text. `transformPrompt` keeps it off the screen:

```tsx
adapters={{
  // …
  transformPrompt: (prompt, { isFirstMessage }) =>
    isFirstMessage && workOrderId ? `${prompt} WORK_ORDER_ID: ${workOrderId}` : prompt,
}}
```

The backend receives the transformed text; the transcript keeps what the user typed. Return
`{ wire, display }` instead of a string to change both. `engine.send(prompt, scope, { wireText })`
is the same split one level down, and `CopilotTurnView.wirePrompt` records the difference.

## Which backend it talks to

There are two wire protocols behind one event vocabulary, and the difference is not academic.

| Transport | Routes                                                                                                           | Status on 2026-08-22                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `agentic` | `POST /api/agentic-ml-request/`, `GET /api/agentic-ml-request/{id}/`, `POST /api/agentic-ml-request/{id}/reply/` | **Live.** What every older chat drawer calls, and the fallback for a deployment without the copilot routes.      |
| `sse`     | `POST /api/copilot-turn/` then `GET /api/copilot/turn/{id}/events`                                               | **Live.** The create landed with ml-engine's copilot admin API, so streaming is the path `auto` now resolves to. |

`transport: 'auto'` (the default) tries the streaming create once and remembers the answer for the
life of the tab. Because that memory is durable, the answer has to be about the route rather than
about the resource. A 404 carrying a DRF `detail` — `NotFound("No such thread.")`, which is what a
stale `?thread=` bookmark produces — is a resource error and is raised with that detail as its
message. A 404 that no application answered is corroborated against `GET /api/copilot-conversation/`
before streaming is given up. `CopilotHttpError.isRouteMissing` and `.isResourceError` are those two
questions, and a transport can answer the first for itself by implementing the optional
`isDeployed()`. Pin `transport: 'agentic'` to skip all of it, or `'sse'` to require streaming.

The thread reads are the exception to that switch. `listThreads` and `fetchThread` answer with an
empty result on a missing route rather than throwing or degrading: a thread id is a Conversation
id, which the agentic resource cannot resolve, and a cluster whose ml-engine serves no thread store
genuinely has no threads. That keeps an always-mounted dock quiet on a cluster that has not shipped
the copilot routes yet. Anything that is not a missing route still raises.

### The routes, as ml-engine actually registers them

Verified against `service/urls.py`, `service/views.py`, `service/serializers.py` and
`service/copilot/sse.py` on 2026-08-22. Two spellings coexist and neither is a typo: the DRF router
registers `copilot-turn`, while the SSE endpoint is served by the ASGI path router ahead of Django
at `copilot/turn`, without a trailing slash.

| Purpose        | Path                                                       |
| -------------- | ---------------------------------------------------------- |
| open a turn    | `POST /api/copilot-turn/`                                  |
| stream a turn  | `GET /api/copilot/turn/{turnId}/events`                    |
| poll a turn    | `GET /api/copilot-turn/{turnId}/`                          |
| cancel a turn  | `POST /api/copilot-turn/{turnId}/cancel/`                  |
| approve a step | `POST /api/copilot-turn/{turnId}/steps/{stepId}/approval/` |
| list threads   | `GET /api/copilot-conversation/`                           |
| thread history | `GET /api/copilot-turn/?conversation={threadId}`           |

`CopilotAskSerializer` accepts both spellings of the two body keys — `prompt`/`prompt_text` and
`thread_id`/`conversation` — and declares no scope field, so a scope key would be dropped and
would still change the idempotency fingerprint. The create honours an `Idempotency-Key` header,
which the SDK sends on every create: one key per user send, so a repeat of that send replays the
run and answers `200` with `replayed: true` rather than spending a second time.

ml-engine registers no cursor-poll route, so when the stream cannot be tailed the SSE transport
polls the run's own detail and diffs successive snapshots — the same way the agentic transport
diffs its resource: `response_text` growth becomes `message_delta`, new `execution_log`
entries become `step_result`, `chart_config` becomes `chart`, and the integer `status` becomes
`queued` / `done` / `error` / `cancelled`. Nothing above the transport can tell them apart.

### Event vocabulary

`run_started` · `queued` · `plan` · `step_started` · `step_result` · `message_delta` · `chart` ·
`usage` · `done` · `error` · `cancelled`

`plan` is **optional**. ml-engine's direct router answers single-domain prompts without ever
consulting the orchestrator, so a perfectly healthy run may never emit one. Nothing blocks on it;
`RunState.hasPlan` records whether it arrived and the timeline renders from whatever steps exist.

The list is **closed**. ml-engine's decoder accepts these eleven names and drops anything else
without a word, which is why run-level facts that have no event of their own — `tools`,
`execution_time`, `result_data` — ride on the terminal `done` or `error` payload instead of on a
twelfth event name. `CopilotRunSummary` is that payload; `RunState.tools`, `RunState.executionMs`
and `RunState.resultData` are where it lands.

What ml-engine actually puts on the wire is thinner than that: `done` carries `status`, `turn_id`,
`execution_time`, `chart_available` and `response_chars`, and `error` carries a code and a detail.
Neither carries `tools` or the tool output behind the result table, and neither can — `events.py`
replaces any event over `COPILOT_EVENT_MAX_BYTES` with a truncation marker, so a fattened frame
would lose the whole run summary rather than shorten it. `SseTransport` therefore holds the terminal
event back for one read of `GET /api/copilot-turn/{turnId}/` and merges in what the frame could not
carry. The frame wins on every key it did send, a failed read still finishes the run, and exactly
one terminal event is emitted, already complete — so a live run shows its tools badge and its result
table with the answer, and nothing above the transport ever clears the panel to get them.

### Approvals

An approval request is a `step_started` event whose step carries `status: "awaiting_approval"`,
keyed by `call_id`. The decision goes back as
`POST /api/copilot-turn/{turnId}/steps/{stepId}/approval/` with
`{"approved": true, "decision": "approve"}`; ml-engine accepts either key and prefers `approved`.
Approving needs the `copilot-action-execute` permission, declining needs none, and a step that has
already been decided answers 409.

Only `SseTransport` implements it. `AgenticTransport.respondToApproval` throws, because the poll
resource surfaces no `awaiting_approval` step and serves no decision route — resolving quietly
would tell a user a destructive action was authorised when nothing recorded it.

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
| `transformPrompt`      | optional                    | Last chance to change what goes on the wire. The transcript keeps what the user typed, so a host scope hint never appears in the user's own chat bubble.            |
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
pnpm install --config.minimumReleaseAge=1440
pnpm lint && pnpm format:check && pnpm test && pnpm build
git add -A dist
git commit -m "release: v0.3.0"
git tag v0.3.0          # lightweight. NEVER -a, NEVER -s
git push origin main
git push origin v0.3.0
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
git cat-file -t v0.3.0
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
