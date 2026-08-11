import { describe, expect, it } from 'vitest'
import {
  distanceFromBottom,
  isJumpShortcut,
  isNearBottom,
  NEAR_BOTTOM_THRESHOLD_PX,
  shouldPreventJumpDefault,
  shouldShowJump,
} from './chatScroll.logic'

function keyEvent(overrides: Partial<Parameters<typeof isJumpShortcut>[0]> = {}) {
  return { key: 'End', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, ...overrides }
}

describe('isNearBottom', () => {
  it('conta como no fim dentro do limiar', () => {
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 920, clientHeight: 80 })).toBe(true)
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 840, clientHeight: 80 })).toBe(true)
  })

  it('conta como longe do fim acima do limiar', () => {
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 200, clientHeight: 80 })).toBe(false)
  })

  it('aceita limiar customizado', () => {
    const metrics = { scrollHeight: 1000, scrollTop: 800, clientHeight: 100 }
    expect(distanceFromBottom(metrics)).toBe(100)
    expect(isNearBottom(metrics, 120)).toBe(true)
    expect(isNearBottom(metrics, NEAR_BOTTOM_THRESHOLD_PX)).toBe(false)
  })
})

describe('shouldShowJump', () => {
  it('não mostra CTA quando o usuário já está no fim', () => {
    expect(shouldShowJump({ latestChanged: true, pinned: true, current: false })).toBe(false)
    expect(shouldShowJump({ latestChanged: false, pinned: true, current: true })).toBe(false)
  })

  it('acende quando chega resposta nova com o usuário longe do fim', () => {
    expect(shouldShowJump({ latestChanged: true, pinned: false, current: false })).toBe(true)
  })

  it('mantém o CTA aceso enquanto o usuário segue longe do fim', () => {
    expect(shouldShowJump({ latestChanged: false, pinned: false, current: true })).toBe(true)
  })

  it('fica apagado sem resposta nova', () => {
    expect(shouldShowJump({ latestChanged: false, pinned: false, current: false })).toBe(false)
  })
})

describe('isJumpShortcut', () => {
  it('aceita Ctrl+End', () => {
    expect(isJumpShortcut(keyEvent())).toBe(true)
  })

  it('ignora End sem Ctrl e outras teclas', () => {
    expect(isJumpShortcut(keyEvent({ ctrlKey: false }))).toBe(false)
    expect(isJumpShortcut(keyEvent({ key: 'Home' }))).toBe(false)
  })

  it('ignora combinações com Alt/Shift/Meta', () => {
    expect(isJumpShortcut(keyEvent({ altKey: true }))).toBe(false)
    expect(isJumpShortcut(keyEvent({ shiftKey: true }))).toBe(false)
    expect(isJumpShortcut(keyEvent({ metaKey: true }))).toBe(false)
  })
})

describe('shouldPreventJumpDefault', () => {
  it('preserva o Ctrl+End nativo em campo de texto', () => {
    expect(shouldPreventJumpDefault({ tagName: 'TEXTAREA' })).toBe(false)
    expect(shouldPreventJumpDefault({ tagName: 'INPUT' })).toBe(false)
    expect(shouldPreventJumpDefault({ tagName: 'DIV', isContentEditable: true })).toBe(false)
  })

  it('bloqueia o scroll nativo fora de campo de texto', () => {
    expect(shouldPreventJumpDefault({ tagName: 'DIV' })).toBe(true)
    expect(shouldPreventJumpDefault(null)).toBe(true)
  })
})
