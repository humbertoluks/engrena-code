import { describe, expect, it } from 'vitest'
import {
  TERMINAL_DOCK_DEFAULT_HEIGHT,
  TERMINAL_DOCK_MAX_HEIGHT,
  TERMINAL_DOCK_MIN_HEIGHT,
  canCloseTerminalTab,
  clampTerminalDockHeight,
  nextHeightFromDrag,
  tabLabel,
} from './terminalDock.logic'

describe('clampTerminalDockHeight', () => {
  it('clamps below min and above max', () => {
    expect(clampTerminalDockHeight(10)).toBe(TERMINAL_DOCK_MIN_HEIGHT)
    expect(clampTerminalDockHeight(900)).toBe(TERMINAL_DOCK_MAX_HEIGHT)
    expect(clampTerminalDockHeight(TERMINAL_DOCK_DEFAULT_HEIGHT)).toBe(TERMINAL_DOCK_DEFAULT_HEIGHT)
  })
})

describe('nextHeightFromDrag', () => {
  it('increases height when pointer moves up', () => {
    expect(nextHeightFromDrag(220, 400, 350)).toBe(270)
  })

  it('decreases height when pointer moves down', () => {
    expect(nextHeightFromDrag(220, 400, 450)).toBe(170)
  })

  it('respects min/max while dragging', () => {
    expect(nextHeightFromDrag(80, 400, 500)).toBe(TERMINAL_DOCK_MIN_HEIGHT)
    expect(nextHeightFromDrag(650, 400, 300)).toBe(TERMINAL_DOCK_MAX_HEIGHT)
  })
})

describe('tabLabel', () => {
  it('uses 1-based position', () => {
    expect(tabLabel(0)).toBe('Terminal 1')
    expect(tabLabel(2)).toBe('Terminal 3')
  })
})

describe('canCloseTerminalTab', () => {
  it('allows close only with more than one tab', () => {
    expect(canCloseTerminalTab(1)).toBe(false)
    expect(canCloseTerminalTab(2)).toBe(true)
  })
})
