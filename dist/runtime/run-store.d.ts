import type { CopilotEvent, EnvelopedEvent, RunState } from '../types';
export declare function initialRunState(): RunState;
export declare function applyEvent(state: RunState, event: CopilotEvent): RunState;
export declare function applyEnveloped(state: RunState, enveloped: EnvelopedEvent): RunState;
export declare function isRunActive(state: RunState): boolean;
export declare function isRunFinished(state: RunState): boolean;
