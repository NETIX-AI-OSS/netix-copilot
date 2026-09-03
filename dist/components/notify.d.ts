import type { CopilotNotification } from '../adapters/types';
export interface NotificationSnapshot {
    current: CopilotNotification | undefined;
}
export declare const notificationStore: {
    subscribe(listener: () => void): () => void;
    getSnapshot(): NotificationSnapshot;
    show(notification: CopilotNotification): void;
    dismiss(): void;
};
export declare function setFallbackNotify(notify: (notification: CopilotNotification) => void): void;
export declare function useNotify(): (notification: CopilotNotification) => void;
