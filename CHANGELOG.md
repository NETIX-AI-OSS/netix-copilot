# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.4.0] — 2026-09-03

### Added

- **Reasoning trace.** A collapsible card between the prompt and the answer that narrates the run
  from real events only: plan reasoning and lines, specialist agent cards with the orchestrator's
  task and side-by-side lanes, nested tool rows with humanised labels, live elapsed time, approval
  highlighting, a "Rebuilt from history" chip, and raw output on read-back. Auto-collapses on
  `done`, stays open on error, collapsed on replay. `ReasoningTrace`, `AgentCard`, `StepRow`,
  `StatusGlyph`, `buildTraceTree` and the `trace-labels` helpers are exported.
- **Additive events.** `agent_started` and `agent_finished`; `route`/`agent` on `run_started`;
  `agent`, `parentId`, `depth`, `startedAt`, `finishedAt`, `task`, `feedback`, `expiresAt` on
  steps; `code` on `error`. An old backend that sends none of them still works: the flat stream
  renders as before and the terminal read-back re-parents rows from `sub_execution_log`, so the
  finished and replayed trace is the correct tree either way (`RunState.rebuilt` says when).
- **Modes.** `CopilotDock` gains `mode` / `onModeChange` (`min` · `dock` · `full`), a `Launcher`
  pill, a maximise button, and a bottom sheet under 640 px. Full mode is composed by the host from
  `HistoryRail` + `CopilotPanel layout='full'`.
- **History rail.** Grouped (Pinned · Today · Yesterday · This week · Earlier), searchable, with
  Pin / Rename / Delete backed by `PATCH` and `DELETE /api/copilot-conversation/{id}/`;
  `engine.updateThread`, `engine.deleteThread`, `useCopilotThreadActions`, `ThreadPatch`. The dock
  shows the same list in a header popover (`ThreadsPopover`).
- **Answer strip and artifacts.** `AnswerActions` (Copy, Regenerate, grounding caption),
  `ArtifactCard` wrapping charts and the result table, `Download CSV` (`toCsv`), `EmptyState` with
  `quickPrompts` chips.
- **Composer.** Page-context chip (`engine.setContextEnabled`, surfaced to `transformPrompt` as
  `includeContext`), Send flips to Stop, auto-grow textarea, disclaimer and Enter hint.
- **Adapters.** `notify` (toast override; the SDK's `ToastHost` pill is the default), `labels`
  (tool/agent name overrides), `quickPrompts`; `useNotify`, `notificationStore`,
  `setFallbackNotify`.
- **Tokens.** `surface2/3`, `borderStrong`, `textTertiary`, `accentSubtle`, `domainCafm`,
  `radiusSm/Md/Lg/Pill`, `elev1/2/3`, `focusRing`, `motionFast/Base`; keyframes `nxcp-modal-in`,
  `nxcp-spin`, `nxcp-blink`, `nxcp-dot`, `nxcp-halo`, all zeroed under `prefers-reduced-motion`.
- i18n keys for the trace, agents, tools, composer, history, answer strip, artifacts and tiers.

### Changed

- The dock is a floating card (430 px wide by default, capped at 94vw, `min(680px, 86vh)` tall,
  inset 22 px) with a FAB launcher instead of a full-height panel and text button; the width drag
  and its 320–720 clamp are unchanged. Threads no longer render as a strip inside the dock.
- `MessageView` renders the new assistant anatomy: meta row, trace, answer, artifact cards,
  approval cards, banners, answer strip. `PlanTimeline` and `RunBadges` stay exported as the
  legacy flat views. The queue position and "Thinking…" now live in the trace header.
- The stylesheet uses logical properties throughout, so RTL hosts need no override; every colour
  goes through a `--nxcp-*` token with a light default on `.nxcp-root`.
- `ThreadList` is a thin wrapper over `HistoryRail`. `--nxcp-shadow` aliases `--nxcp-elev-3` and
  `--nxcp-surface-2` aliases `--nxcp-surface-muted`, so a host setting only the v0.3 names still
  paints.
- Host-facing class names (`.nxcp-root .nxcp-launcher .nxcp-dock .nxcp-panel .nxcp-turn
.nxcp-bubble .nxcp-answer .nxcp-chart .nxcp-badge .nxcp-empty` …), `renderTurn` semantics and
  every v0.3 export are preserved.
- A host `emptyState` replaces the whole default placeholder (tile, heading, body), as in v0.3;
  `quickPrompts` chips still render beneath it.
- The footer shows the transport as a small dot (`.nxcp-transport-dot[data-transport]`) whose
  tooltip and accessible name carry the word, instead of visible text.
- The launcher's accessible name is its visible label (`copilot.dock.open`, "Ask Copilot").
- Thread row actions are plain buttons in a labelled `role="group"`, not an ARIA menu.
- The streaming caret is drawn inside the answer's last block, so it trails the last character.
- `--nxcp-surface-3`, `--nxcp-border-strong`, `--nxcp-text-tertiary`, `--nxcp-accent-subtle` and
  `--nxcp-focus-ring` default to `color-mix` derivations of the v0.3 tokens, so a host that only
  themes those (a dark theme included) stays coherent.
- Direct-routed runs: ml-engine's synthetic `direct-*` plan_trace marker now sets `route` and
  `agent` on the replayed run instead of drawing an empty specialist card; the live `make_plan`
  row is dropped once the terminal event carries the plan; `RunState.rebuilt` is set only when a
  stored call never streamed, not when the read-back merely filled in lineage.

## [0.3.0] — 2026-08-24

### Added

- Public Base 1x, High 5x, and Max 20x model tiers with server-owned provider mappings.
- `useCopilotModelTier` and an accessible, responsive `ModelTierSelector` that locks with a thread.
- A non-portalled `CopilotPanel` with host slots for headers, footers, prompts, empty states, and turns.
- Conversation-surface filtering for isolated global and embedded history.

### Changed

- Replaced the wide segmented tier control with a compact, composer-integrated tier picker.
- Every create and reply sends the selected tier and surface, including the polling fallback.
- Restored conversations recover their tier; failed initial creates remain editable; New resets to Base.
- The composer and usage footer now share polished light/dark, narrow-width, and reduced-motion styles.
- Usage renders friendly tier labels only, and renders provider cost only when the server supplies it.

## [0.2.3] — 2026-08-22

Both defects here were found while adopting streaming in cafm-v2-ui, and both undo the same thing:
they make a run less visible than the drawer it replaces. One decides the streaming contract is not
deployed because a single request 404'd, and never revisits it. The other loses the tools badge and
the result table on every live run, and gets them back only when the thread is read again.

### Fixed

- **A real 404 is no longer read as a missing route.** `isRouteMissing` was a bare status test, so
  it could not tell "this cluster does not serve this route" from "this resource does not exist".
  ml-engine's `ConversationTurnViewSet._thread` raises `NotFound("No such thread.")` when a create
  names a thread that is missing or belongs to someone else — a genuine 404, with a JSON body — and
  `AutoTransport` read that as proof the streaming routes were undeployed and pinned the tab to the
  agentic contract for the rest of its life. One stale bookmarked `?thread=` cost that tab streaming
  permanently, invisibly, and sent the reply to `POST /api/agentic-ml-request/<that id>/reply/`.
  A 404 whose body is a DRF error object — a JSON object carrying a non-empty string `detail` — is
  now a resource error and is raised, with that detail as the error message so the user reads
  "No such thread." rather than a status line. 405 and 501 stay fallback-worthy whatever the body:
  they answer about the contract, not about the resource.
- **A durable degrade is corroborated before it is taken.** Even a bodiless 404 is one request's
  answer, and `AutoTransport`'s decision outlives the request by the life of the tab. Before giving
  up streaming it now asks the streaming contract directly, through the new optional
  `CopilotTransport.isDeployed()`, which `SseTransport` answers with a read of
  `GET /api/copilot-conversation/` — a route that takes no arguments and so cannot answer about a
  resource. Only a missing route there is believed; a list, a 401 or a 500 all mean the contract is
  served. A transport that does not implement the probe degrades exactly as before. The probe runs
  on the failure path only, once, and never on the remembered answer.
- **Streaming keeps the tools badge and the result table.** `RunState.tools` and
  `RunState.resultData` are populated from the terminal payload, and ml-engine's SSE `done` frame
  carries `status`, `turn_id`, `execution_time`, `chart_available` and `response_chars` — not
  `tools`, not `result_data`. The `error` frame is thinner still. So adopting streaming was a
  visible regression against the agentic transport, which synthesises both by diffing the row
  snapshot. `SseTransport` now holds the terminal event back for exactly one read of
  `GET /api/copilot-turn/{turnId}/` and merges the run summary the frame could not carry into it.
  The frame wins on every key it did send. A failed read still finishes the run. One terminal event
  is emitted, already complete, so the panel is never cleared and repopulated to show the badges.

### Added

- **`isResourceError`**, alongside `isRouteMissing`, plus `CopilotHttpError.isResourceError` and
  `CopilotHttpError.detail`, so a host writing its own transport can draw the same line.
- **`CopilotTransport.isDeployed?()`**, the capability question asked of a contract rather than
  inferred from a request. Optional, like `fetchThread`, so a transport written against v0.1.0 still
  satisfies the interface.

### Notes

- **This did not belong in ml-engine.** Adding `tools` to the `done` frame would fit — it is a short
  list of names — but the tool output behind the result table would not, and `encode_payload` in
  `service/copilot/events.py` replaces any event over `COPILOT_EVENT_MAX_BYTES` with a truncation
  marker rather than trimming it, so an oversized frame loses the whole run summary. The SDK would
  still need the read-back for the table, so the backend change buys nothing the SDK does not
  already have to do.
- **The capability-inference pattern was swept for.** `AutoTransport.resolved` is the only durable
  capability state in the package, set in `createTurn` and `consumeRun`, and both now corroborate.
  Every other `isRouteMissing` site is per-call and re-tries on the next call: `SseTransport`'s
  fall back from the stream to the run detail, `readOrEmpty` in both transports, and the thread
  reads on `AutoTransport`. Those are answers about one request, used for one request, and were
  left as they are.

## [0.2.2] — 2026-08-22

A follow-up to v0.2.1, and reachable because of it. Moving the thread reads onto the streaming
transport was right — a thread id is a Conversation id and only that contract resolves one — but
those two reads were the only transport methods with no `isRouteMissing` degrade, so on a cluster
whose ml-engine has not shipped the copilot routes they rejected instead of answering empty. Both
host apps mount the dock on every authenticated route, so that is a per-page-load failure on an
always-on surface, which is the class of problem this package was written to remove.

### Fixed

- **A missing thread route answers empty instead of throwing.** `listThreads` and `fetchThread`
  now degrade on 404/405/501 in all three transports — `AutoTransport`, `SseTransport` and
  `AgenticTransport` — so a `transport: 'sse'` or `transport: 'agentic'` pin is covered as well as
  the `auto` default. A service with no thread store genuinely has no threads. Anything that is
  not a missing route still raises, so a real failure cannot pose as "no history".
- The thread reads deliberately do **not** fall back to the polling transport. A Conversation id is
  unreadable on the agentic resource, and degrading there is what caused the permanent-degrade bug
  fixed in v0.2.1. Returning empty is the correct answer; falling back is not.

### Added

- **`isRouteMissing`** is exported from the transport surface, so a host writing its own transport
  can apply the same rule rather than re-deriving it from `CopilotHttpError.status`.

### Notes

The other transport methods were audited for the same hole and left as they are. `createTurn` and
`consumeRun` must raise so `AutoTransport` can choose a transport; `cancelTurn` already swallows
everything, because the run ends server-side regardless; `respondToApproval` stays loud on purpose,
since quietly reporting success for a decision nothing recorded would tell a user a destructive
action was authorised.

## [0.2.1] — 2026-08-22

A wire-contract repair. ml-engine's copilot admin API added `POST /api/copilot-turn/`, and this
SDK was still pointing its create at the blueprint's `/api/copilot/turns/`. The effect was not a
visible error: `auto` read the 404 as "streaming is not deployed", degraded to the agentic poll
contract on every first send, and the streaming path this package exists for never engaged.

### Fixed

- **`DEFAULT_SSE_ENDPOINTS.createTurn`** is `/api/copilot-turn/`, the route the DRF router
  registers. All seven defaults are re-verified against `service/urls.py`, `service/views.py` and
  `service/copilot/sse.py`, and a test pins every one of them including the trailing slashes.
- **`DEFAULT_SSE_ENDPOINTS.pollTurn`** is `/api/copilot-turn/{turnId}/`. There is no
  `.../events/` sibling on ml-engine and never was; the fallback now polls the run's own detail
  and diffs snapshots the way the agentic transport does. An event-page payload is still accepted,
  so a host that points `pollTurn` at one of its own keeps working.
- **`AutoTransport` reads threads through streaming** before a transport is chosen. A thread id is
  a conversation id — it is what a briefing deep link carries — and only the streaming contract can
  resolve one, so sending it to the agentic detail route fetched the wrong row.
- **The engine resumes on the `stream_url` the create returned** instead of re-deriving it from
  the template when the browser comes back online.

### Added

- **`Idempotency-Key` on every create.** `CopilotEngine.send` mints one key per user send and
  `SendTurnInput.idempotencyKey` carries it, so a retry of that send replays server-side rather
  than spending a second time. A new send always gets a new key. `AgenticTransport` uses the same
  key instead of deriving its own from the prompt and a timestamp.
- **`newIdempotencyKey`**, and `diffRunSnapshot` / `RunCursor` / `RunSnapshot` / `isTerminalStatus`
  from the new shared `run-diff` module, exported for hosts that write their own transport.

### Removed

- **`scope` is no longer sent on the SSE create body.** `CopilotAskSerializer` declares no scope
  field, so DRF dropped it — while it still changed the idempotency fingerprint. `SendTurnInput.scope`
  stays: the agentic transport reads `organization_id` and `user_id` out of it, and page context
  reaches the model through `transformPrompt` as it already did.

## [0.2.0] — 2026-08-21

The first release written against a shipped backend rather than a blueprint, and against a real
adoption rather than an imagined one. cafm-v2-ui's PR #1734 could not use `CopilotDock` at all and
composed its own drawer out of the exported primitives; everything below is what that cost.

### Added

- **Controlled open state on `CopilotDock`.** `open` and `onOpenChange` let a host own the state,
  which is what a `?ai_open=1` URL contract, `?open_knowledge_base=1`, a topbar button and a
  `?thread=` deep link all need. Precedence is now explicit and tested: the `open` prop beats the
  stored value, the stored value beats `defaultOpen`. localStorage persistence stays, but only for
  the uncontrolled dock — a controlled host is never overwritten by a stale stored value.
- **`showLauncher`**, for a host that opens the dock from its own chrome and does not want the
  floating launcher as well.
- **`transformPrompt` adapter**, so what goes on the wire and what the user reads can differ.
  cafm-v2-ui appends `WORK_ORDER_ID: 4242` because the agentic contract has no scope field, and
  that suffix was appearing in the user's own chat bubble. The displayed text stays authoritative
  for the transcript; `CopilotTurnView.wirePrompt` records the difference without rendering it.
  `engine.send(prompt, scope, { wireText })` is the same split at the engine level, and
  `resolveCopilotPrompt` is the pure resolver behind both.
- **`result_data` tables.** `CopilotResultData` normalizes every shape the field comes back in —
  `{columns, data}`, `{columns, rows}`, positional rows, a bare list of row objects, a plain
  object, a scalar, or any of those stored as JSON text — and `ResultTable` renders it, capped at
  ten rows with a count of what is hidden, exactly as the drawer it replaces did.
- **Per-message badges.** `RunBadges` reports the run status, how long it took and which tools it
  used. `MessageView` renders both new surfaces by default; `showBadges={false}` and
  `showResultData={false}` opt a host out.
- **History replay.** `engine.selectThread(id)` now fetches and rebuilds the thread rather than
  clearing the panel, through a new optional `CopilotTransport.fetchThread`. A replayed turn
  carries its plan, its charts, its result table, its tools and its timing, so it renders through
  the same components as a turn that just finished. `engine.loadThread(id)` is the awaitable form,
  and `CopilotEngineState.threadLoading` reports the fetch.

### Fixed

- **Every step event rendered twice.** The decoder synthesized a step id per decoded step. ml-engine
  #316 sends `call_id` on both `step_started` and `step_result` and it is the only key stable
  across the pair, so it is now preferred over any other id and looked for at both nesting levels.
  Synthesis is the last resort it was always meant to be.
- **`chart` events were dropped on the streaming wire.** ml-engine emits `{ chart_config: … }`;
  the decoder looked for `option`, `options`, `chart`, `config` and `spec`, and silently discarded
  anything else. `chart_config` is now the first key it looks for.
- **`credits_remaining` was dropped by the poll transport.** ml-engine #316 computes it live and
  blends it into `usage` on both the SSE event and the REST payload; the agentic transport's usage
  mapper read only tokens, calls and cost. It now reads credits, the used count and the model, and
  the streaming decoder now reads calls and cost, which it had been dropping in the other
  direction. The stale comment in `usage-footer.tsx` claiming ml-engine never returns a credit
  balance is gone; the figure was always rendered when present, and now it arrives.
- **A failed step read as one still waiting.** The stored `plan` column is ml-engine's plan_trace,
  whose entries carry `in_progress`, `completed`, `errored` or `rejected`. Everything that was not
  `completed` collapsed to `pending`. `errored` is also now a decoder alias for `error`.
- **Copilot route paths.** Verified against ml-engine's `service/urls.py`, `service/views.py` and
  `service/copilot/sse.py` on `feat/copilot-w2-memory-and-actions`. The blueprint paths this SDK
  shipped with were wrong in every case except the request body:
  - approvals: `/api/copilot/turns/{id}/steps/{stepId}/approval/` → `/api/copilot-turn/{id}/steps/{stepId}/approval/`
  - cancel: `/api/copilot/turns/{id}/cancel/` → `/api/copilot-turn/{id}/cancel/`
  - stream: `/api/copilot/turns/{id}/stream/` → `/api/copilot/turn/{id}/events`
  - threads: `/api/copilot/threads/` → `/api/copilot-conversation/`
  - thread history: new, `/api/copilot-turn/?conversation={id}`
- **Thread list timestamps.** `ConversationSerializer` orders by and exposes `last_activity_at`,
  which the list decoder did not look at.

### Notes

- **The approval wire formats agree.** ml-engine #316 models an approval exactly as v0.1.0
  assumed: a `step_started` event whose step carries `status: "awaiting_approval"`, flat, keyed by
  `call_id`, with no twelfth event name and no alias. The decision endpoint accepts
  `{"approved": bool}` and/or `{"decision": "approve"|"reject"}` and prefers `approved` when both
  arrive, which is exactly what `SseTransport.respondToApproval` sends. Only the path was wrong.
- **`AgenticTransport.respondToApproval` still throws, and that is still right.** The poll resource
  surfaces no `awaiting_approval` step and serves no decision route, so there is nothing to record
  against; resolving quietly would tell a user a destructive action was authorised when nothing
  recorded it.
- **ml-engine's `result_data` field is effectively always null in production.**
  `AgenticMLRequestSerializer.get_result_data` scans `messages` for the Responses-API shape
  `{"type": "function_call_output"}`, while the live agent loop appends Chat-Completions messages
  `{"role": "tool", …}`. The only producers of the shape it looks for are ml-engine's own unit
  tests. The SDK reads the field when it is populated and otherwise falls back to the newest
  `execution_log[].output`, which is where the rows actually are. Worth a backend fix.
- **There is still no create-turn route on the streaming contract.** `POST /api/copilot/turns/`
  does not exist: a turn is opened through `POST /api/agentic-ml-request/`, whose response carries
  the `turn_id` to tail. `transport: 'auto'` therefore still resolves to the poll transport on the
  first send in every current cluster, exactly as it did in v0.1.0.

## [0.1.0] — 2026-08-21

Initial release.

### Added

- `CopilotProvider` plus the host adapter contract: page context, chart renderer, permission
  check, translate function and theme tokens. No data-layer adapter, because the SDK owns its
  own fetch and depends on neither SWR nor react-query.
- Components: persistent resizable dock, thread list, composer, streaming markdown message view,
  plan/step timeline, approval cards and usage footer.
- Two transports behind one event vocabulary: `SseTransport` for the streaming turn contract, and
  `AgenticTransport` for the `agentic-ml-request` create-then-poll contract ml-engine serves
  today. `AutoTransport` probes streaming once and degrades permanently on a missing route.
- Hand-written SSE parser over `fetch()` + `ReadableStream`, with `Last-Event-ID` resume. Native
  `EventSource` is unusable because it cannot set an `Authorization` header and the gateway's
  ext_authz filter has no cookie fallback.
- A markdown renderer built for partial documents, so an unclosed fence still renders as code and
  an unclosed emphasis marker stays literal instead of swallowing the answer. Keeps
  `react-markdown` out of the dependency tree.
- `COPILOT_Z_INDEX`, a 60000-band stacking scale measured against what the host apps actually
  paint rather than assumed.

### Notes

- The streaming routes do not exist on ml-engine yet; verified 2026-08-21. `auto` therefore
  resolves to the agentic transport in every current cluster.
- `plan` is treated as optional throughout: ml-engine's direct router answers single-domain
  prompts without consulting the orchestrator, so a healthy run may never emit one.
- Built output is committed, mirroring `envoy-ts-auth`, so `github:` consumers need no build step.
- `target` is ES2020 rather than envoy-ts-auth's ES2016, the one deliberate tsconfig deviation:
  this package is stream-heavy and the ES2016 downlevel wraps every read in a generator
  trampoline. Everything else about the build mirrors that package.
