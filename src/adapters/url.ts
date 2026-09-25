// The dock's deep-link contract: `?ai_open=1` opens it, `&thread=<id>` restores a conversation.
// The package reads and writes these through a host adapter, so it stays router-agnostic.

export const COPILOT_URL_PARAMS = { open: 'ai_open', thread: 'thread' } as const

export interface CopilotUrlState {
  // The current value of a search param, or null when absent.
  get(param: string): string | null
  // Apply several changes in one history entry; null removes a param. Hosts should replace the
  // entry rather than push one, so opening the dock never adds a Back step.
  set(changes: Record<string, string | null>): void
}

/** The URL that opens the dock over `path`, on `threadId` when one is given. */
export function copilotDeepLink(threadId?: string, path = '/'): string {
  const search = new URLSearchParams({ [COPILOT_URL_PARAMS.open]: '1' })
  if (threadId) search.set(COPILOT_URL_PARAMS.thread, threadId)
  return `${path}?${search.toString()}`
}

/** The thread a URL names; a blank `?thread=` is absent. */
export function readUrlThread(url: CopilotUrlState): string | undefined {
  const thread = url.get(COPILOT_URL_PARAMS.thread)
  return thread === null || thread === '' ? undefined : thread
}

/** Open when the flag is set, or when a thread is named (a briefing link minted without the flag). */
export function isUrlOpen(url: CopilotUrlState): boolean {
  return url.get(COPILOT_URL_PARAMS.open) === '1' || readUrlThread(url) !== undefined
}
