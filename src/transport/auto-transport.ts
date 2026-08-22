// Picks a transport once and remembers the answer.
// The streaming create is the live contract, so it is what everything defaults to before the first send.
// A create that 404s means a deployment without those routes; that tab then stays on the agentic poll contract.

import type { CopilotThread, SendTurnInput } from '../types'
import { CopilotHttpError } from './http'
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
      if (!isRouteMissing(error)) throw error
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
      if (!isRouteMissing(error)) throw error
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
  listThreads(signal?: AbortSignal): Promise<CopilotThread[]> {
    return (this.resolved ?? this.streaming).listThreads(signal)
  }

  async fetchThread(threadId: string, signal?: AbortSignal): Promise<CopilotTranscriptTurn[]> {
    const target = this.resolved ?? this.streaming
    return target.fetchThread ? target.fetchThread(threadId, signal) : []
  }
}

function isRouteMissing(error: unknown): boolean {
  return error instanceof CopilotHttpError && error.isRouteMissing
}
