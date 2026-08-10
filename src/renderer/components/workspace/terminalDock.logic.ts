/** Height bounds for the terminal dock body (legacy LionCodeLabs: 72–680, default 220). */
export const TERMINAL_DOCK_MIN_HEIGHT = 72
export const TERMINAL_DOCK_MAX_HEIGHT = 680
export const TERMINAL_DOCK_DEFAULT_HEIGHT = 220

export function clampTerminalDockHeight(height: number): number {
  return Math.min(TERMINAL_DOCK_MAX_HEIGHT, Math.max(TERMINAL_DOCK_MIN_HEIGHT, height))
}

/** Drag handle sits on top of the dock: moving the pointer up increases height. */
export function nextHeightFromDrag(startHeight: number, startY: number, clientY: number): number {
  return clampTerminalDockHeight(startHeight + (startY - clientY))
}

export function tabLabel(index: number): string {
  return `Terminal ${index + 1}`
}

/** Close affordance only when more than one tab remains (legacy dock). */
export function canCloseTerminalTab(tabCount: number): boolean {
  return tabCount > 1
}
