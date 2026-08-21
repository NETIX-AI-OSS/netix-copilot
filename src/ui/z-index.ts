// The stacking scale, chosen from what the host apps actually paint rather than from habit.
//
// Measured on 2026-08-21:
//
// - The toaster mounted in viz-ui (App.tsx), cafm-v2-ui (app.tsx) and prism-ui is sonner, not
//   Radix. sonner hard-codes `z-index: 999999999` on [data-sonner-toaster] in its own
//   stylesheet, and neither app overrides it. Toasts therefore win against everything.
// - The familiar `z-[100]` belongs to the Radix ToastViewport in viz-ui's
//   src/components/ui/toast.tsx. That component is only referenced by ui/toaster.tsx, which no
//   app mounts, so 100 is not the ceiling anyone assumes it is.
// - viz-ui's own dashboard chrome is the real competition: spatial-widget.tsx paints toolbars at
//   z-[40000] and z-[30000], canvas-scene-transition.tsx at z-[30000], and a drei Html layer
//   uses zIndexRange [10000, 0]. cafm-v2-ui tops out at z-[100].
//
// So the dock sits in a 60000 band: clear of viz-ui's 40000 with room to spare, and far below
// sonner so a toast is still readable over an open dock. The internal ordering mirrors the AI
// concierge prototype in frontend/customer-v2/mock (orb above dock, overlay above both), rebased
// out of that prototype's self-contained 50-160 range into real application territory.

export const COPILOT_Z_INDEX = {
  // The dock panel itself.
  dock: 60000,
  // The launcher orb, above the dock's edge so it stays grabbable while the dock animates.
  launcher: 60010,
  // Menus and tooltips owned by the dock.
  popover: 60020,
  // Full-surface takeovers such as an expanded approval or a maximised chart.
  overlay: 60030,
} as const

export type CopilotZIndexLayer = keyof typeof COPILOT_Z_INDEX

// Documented for hosts that need to slot their own chrome around the dock.
export const COPILOT_Z_INDEX_NOTES = {
  sonnerToaster: 999999999,
  vizUiMaxChrome: 40000,
  radixToastViewportUnmounted: 100,
} as const
