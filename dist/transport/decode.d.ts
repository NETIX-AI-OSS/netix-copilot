import type { EnvelopedEvent } from '../types';
import type { SseFrame } from './sse';
export declare function resetSyntheticStepCounter(): void;
export declare function decodeFrame(frame: SseFrame): EnvelopedEvent | null;
export declare function decodePolledEvent(value: unknown): EnvelopedEvent | null;
