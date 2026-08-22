// Picks a transport once and remembers the answer.
// The streaming create is the live contract, so it is what everything defaults to before the first send.
// A create that reports a missing route means a deployment without those routes; that tab then stays
// on the agentic poll contract. Because that decision lasts the life of the tab, it is never taken on
// the strength of one request: the streaming contract is asked directly before streaming is given up.

import type { CopilotThread, SendTurnInput } from '../types'
import { isRouteMissing } from './http'
import type {
  ConsumeRunOptions,
  CopilotTranscriptTurn,
  CopilotTransport,
  CreatedTurn,
  TransportName,
} from './types'

export class AutoTransport implements CopilotTransport {
  private resolved: CopilotTransport | undefined

  constructor(
    private readonly streaming: CopilotTransport,
    private readonly polling: CopilotTransport,
  ) {}

  get name(): TransportName {
    return this.resolved?.name ?? this.streaming.name
  }

  // The transport that has actually been chosen, or undefined before the first turn.
  get selected(): TransportName | undefined {
    return this.resolved?.name
  }

  async createTurn(input: SendTurnInput, signal?: AbortSignal): Promise<CreatedTurn> {
    if (this.resolved) return this.resolved.createTurn(input, signal)
    try {
      const created = await this.streaming.createTurn(input, signal)
      this.resolved = this.streaming
      return created
    } catch (error) {
      if (!(await this.streamingIsAbsent(error, signal))) throw error
      this.resolved = this.polling
      return this.polling.createTurn(input, signal)
    }
  }

  async consumeRun(options: ConsumeRunOptions): Promise<void> {
    if (this.resolved) return this.resolved.consumeRun(options)
    try {
      await this.streaming.consumeRun(options)
      this.resolved = this.streaming
    } catch (error) {
      if (!(await this.streamingIsAbsent(error, options.signal))) throw error
      this.resolved = this.polling
      await this.polling.consumeRun(options)
    }
  }

  cancelTurn(turnId: string): Promise<void> {
    return (this.resolved ?? this.polling).cancelTurn(turnId)
  }

  respondToApproval(turnId: string, stepId: string, approved: boolean): Promise<void> {
    return (this.resolved ?? this.streaming).respondToApproval(turnId, stepId, approved)
  }

  // Threads are conversations, and a conversation id is what a briefing deep link carries, so the
  // list and the transcript both read through streaming until a failed create says otherwise.
  // A missing route answers empty rather than throwing: this dock is mounted on every
  // authenticated route, and a cluster whose ml-engine has no thread store genuinely has no
  // threads. It must not degrade to polling, which cannot resolve a conversation id at all.
  async listThreads(signal?: AbortSignal): Promise<CopilotThread[]> {
    try {
      return await (this.resolved ?? this.streaming).listThreads(signal)
    } catch (error) {
      if (isRouteMissing(error)) return []
      throw error
    }
  }

  async fetchThread(threadId: string, signal?: AbortSignal): Promise<CopilotTranscriptTurn[]> {
    const target = this.resolved ?? this.streaming
    if (!target.fetchThread) return []
    try {
      return await target.fetchThread(threadId, signal)
    } catch (error) {
      if (isRouteMissing(error)) return []
      throw error
    }
  }

  // One request's failure is never proof that a contract is absent. ml-engine 404s a create that
  // names a thread the caller does not own, and reading that as "streaming is not deployed" pinned
  // the tab to polling for good over a stale bookmark. So a missing-route answer is corroborated
  // against the streaming contract itself, and only a transport that cannot be asked is believed.
  private async streamingIsAbsent(error: unknown, signal?: AbortSignal): Promise<boolean> {
    if (!isRouteMissing(error)) return false
    const probe = this.streaming.isDeployed
    if (probe === undefined) return true
    try {
      return !(await probe.call(this.streaming, signal))
    } catch {
      return true
    }
  }
}
