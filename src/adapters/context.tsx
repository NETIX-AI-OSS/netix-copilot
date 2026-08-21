// Provider and hooks. The engine is created once and read through useSyncExternalStore, which
// is what makes the whole surface StrictMode-safe: a double mount adds and removes a listener
// and never touches the network.

import type { ReactNode } from 'react'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'

import type { CopilotEngineState, CopilotLogger } from '../runtime/engine'
import { CopilotEngine } from '../runtime/engine'
import type { CopilotTransportConfig } from '../transport'
import { createTransport } from '../transport'
import type { CopilotTransport } from '../transport/types'
import type { RunState } from '../types'
import type { CopilotAdapters } from './types'
import { buildScope } from './types'

export interface CopilotConfig extends CopilotTransportConfig {
  // Permission codename gating the whole surface. Defaults to the ml-engine permission the
  // existing chat drawers already check.
  permission?: string
  teardownGraceMs?: number
  maxResumeAttempts?: number
  resumeDelayMs?: number
  logger?: CopilotLogger
}

interface CopilotContextValue {
  engine: CopilotEngine
  adapters: CopilotAdapters
  config: CopilotConfig
}

const CopilotContext = createContext<CopilotContextValue | null>(null)

export const DEFAULT_COPILOT_PERMISSION = 'ai-assistant-view'

export interface CopilotProviderProps {
  config: CopilotConfig
  adapters: CopilotAdapters
  // Supplied only by tests and by hosts that need a bespoke wire protocol.
  transport?: CopilotTransport
  children?: ReactNode
}

export function CopilotProvider({
  config,
  adapters,
  transport,
  children,
}: CopilotProviderProps): ReactNode {
  // Built once, by a lazy state initializer, so the engine identity survives every host render.
  // Nothing here reads the adapters: the identity the agentic contract needs travels with each
  // turn's scope instead, which keeps this a pure render.
  const [engine] = useState(
    () =>
      new CopilotEngine({
        transport: transport ?? createTransport(config),
        ...(config.teardownGraceMs === undefined
          ? {}
          : { teardownGraceMs: config.teardownGraceMs }),
        ...(config.maxResumeAttempts === undefined
          ? {}
          : { maxResumeAttempts: config.maxResumeAttempts }),
        ...(config.resumeDelayMs === undefined ? {} : { resumeDelayMs: config.resumeDelayMs }),
        ...(config.logger ? { logger: config.logger } : {}),
      }),
  )

  useEffect(() => {
    engine.retain()
    return () => {
      // release(), never dispose(): StrictMode runs this cleanup between two mounts and a live
      // run has to survive it. release() only stops work if nothing re-retains within the grace.
      engine.release()
    }
  }, [engine])

  const value = useMemo<CopilotContextValue>(
    () => ({ engine, adapters, config }),
    [engine, adapters, config],
  )

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>
}

function useCopilotContext(): CopilotContextValue {
  const value = useContext(CopilotContext)
  if (value === null) {
    throw new Error('netix-copilot: this hook must be used inside <CopilotProvider>.')
  }
  return value
}

export function useCopilotEngine(): CopilotEngine {
  return useCopilotContext().engine
}

export function useCopilotAdapters(): CopilotAdapters {
  return useCopilotContext().adapters
}

export function useCopilotConfig(): CopilotConfig {
  return useCopilotContext().config
}

export function useCopilotState(): CopilotEngineState {
  const { engine } = useCopilotContext()
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
}

// The run of the newest turn, or undefined before the first send.
export function useCopilotRun(): RunState | undefined {
  const state = useCopilotState()
  return state.turns[state.turns.length - 1]?.run
}

// Whether the current user may use the copilot at all.
export function useCopilotEnabled(): boolean {
  const { adapters, config } = useCopilotContext()
  return adapters.hasPermission(config.permission ?? DEFAULT_COPILOT_PERMISSION)
}

// Send the composer's text with the host's page context attached as scope.
export function useCopilotSend(): (prompt: string) => void {
  const { engine, adapters } = useCopilotContext()
  return (prompt: string) => {
    void engine.send(prompt, buildScope(adapters.pageContext))
  }
}
