import type { ReactNode } from 'react';
import type { CopilotChart, JsonObject } from '../types';
export interface CopilotUser {
    id: number;
    organizationId: number;
    name?: string;
    email?: string;
}
export interface CopilotPageContext {
    app: string;
    route: string;
    routeParams?: Record<string, string>;
    searchParams?: Record<string, string>;
    user: CopilotUser;
    entity?: {
        type: string;
        id: string | number;
        label?: string;
    };
    state?: JsonObject;
}
export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;
export interface CopilotPrompt {
    wire: string;
    display?: string;
}
export interface CopilotPromptContext {
    pageContext: CopilotPageContext;
    threadId?: string;
    isFirstMessage: boolean;
}
export type CopilotPromptTransform = (prompt: string, context: CopilotPromptContext) => string | CopilotPrompt;
export interface CopilotThemeTokens {
    colorScheme?: 'light' | 'dark';
    surface?: string;
    surfaceMuted?: string;
    border?: string;
    text?: string;
    textMuted?: string;
    accent?: string;
    accentText?: string;
    danger?: string;
    success?: string;
    warning?: string;
    radius?: string;
    fontFamily?: string;
    monoFontFamily?: string;
    shadow?: string;
}
export interface CopilotChartRenderContext {
    height: number;
    streaming: boolean;
}
export interface CopilotMarkdownRenderContext {
    streaming: boolean;
}
export interface CopilotAdapters {
    pageContext: CopilotPageContext;
    renderChart: (chart: CopilotChart, context: CopilotChartRenderContext) => ReactNode;
    hasPermission: (codename: string) => boolean;
    t: TranslateFn;
    theme: CopilotThemeTokens;
    renderMarkdown?: (markdown: string, context: CopilotMarkdownRenderContext) => ReactNode;
    transformPrompt?: CopilotPromptTransform;
    onNavigate?: (href: string) => void;
    logger?: {
        warn: (message: string, detail?: unknown) => void;
        error: (message: string, detail?: unknown) => void;
    };
}
export declare function resolveCopilotPrompt(prompt: string, transform: CopilotPromptTransform | undefined, context: CopilotPromptContext): {
    display: string;
    wire: string;
};
export declare function buildScope(pageContext: CopilotPageContext): JsonObject;
