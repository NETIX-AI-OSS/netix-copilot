export interface SseFrame {
    event: string;
    data: string;
    id?: string;
    retryMs?: number;
}
export declare class SseParser {
    private buffer;
    private dataLines;
    private eventName;
    private lastId;
    private frameId;
    private retryMs;
    private sawFrameId;
    push(chunk: string): SseFrame[];
    flush(): SseFrame[];
    getLastEventId(): string | undefined;
    setLastEventId(id: string | undefined): void;
    private nextLineEnd;
    private consumeLine;
    private dispatch;
    private resetFrame;
}
export declare function readSseStream(body: ReadableStream<Uint8Array>, onFrame: (frame: SseFrame) => void, options?: {
    parser?: SseParser;
    signal?: AbortSignal;
}): Promise<void>;
