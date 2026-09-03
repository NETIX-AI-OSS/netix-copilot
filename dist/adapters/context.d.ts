import type { ReactNode } from 'react';
import type { CopilotEngineState, CopilotLogger } from '../runtime/engine';
import { CopilotEngine } from '../runtime/engine';
import type { CopilotTransportConfig } from '../transport';
import type { CopilotTransport } from '../transport/types';
import type { RunState } from '../types';
import type { ModelTier } from '../types';
import type { CopilotAdapters } from './types';
export interface CopilotConfig extends CopilotTransportConfig {
    permission?: string;
    teardownGraceMs?: number;
    maxResumeAttempts?: number;
    resumeDelayMs?: number;
    logger?: CopilotLogger;
    conversationSurface?: 'web' | 'mobile' | 'embed' | 'api';
}
export declare const DEFAULT_COPILOT_PERMISSION = "ai-assistant-view";
export interface CopilotProviderProps {
    config: CopilotConfig;
    adapters: CopilotAdapters;
    transport?: CopilotTransport;
    children?: ReactNode;
}
export declare function CopilotProvider({ config, adapters, transport, children, }: CopilotProviderProps): ReactNode;
export declare function useCopilotEngine(): CopilotEngine;
export declare function useCopilotAdapters(): CopilotAdapters;
export declare function useCopilotConfig(): CopilotConfig;
export declare function useCopilotState(): CopilotEngineState;
export declare function useCopilotRun(): RunState | undefined;
export interface CopilotModelTierState {
    tier: ModelTier;
    locked: boolean;
    setTier: (tier: ModelTier) => void;
}
export declare function useCopilotModelTier(): CopilotModelTierState;
export declare function useCopilotEnabled(): boolean;
export declare function useCopilotSend(): (prompt: string) => void;
export interface CopilotThreadActions {
    rename: (threadId: string, title: string) => Promise<void>;
    pin: (threadId: string, on: boolean) => Promise<void>;
    remove: (threadId: string) => Promise<void>;
}
export declare function useCopilotThreadActions(): CopilotThreadActions;
export declare function useCopilotRegenerate(): (turnId: string) => void;
