import { describe, expect, it } from 'vitest'
import {
  isCountdownWarning,
  PERMISSION_COUNTDOWN_WARN_MS,
  remainingLabel,
} from './permissionCountdown.logic'

const NOW = 1_700_000_000_000

describe('remainingLabel (F30)', () => {
  it('formata mm:ss zero-padded', () => {
    expect(remainingLabel(NOW + 120_000, NOW)).toBe('02:00')
    expect(remainingLabel(NOW + 65_000, NOW)).toBe('01:05')
    expect(remainingLabel(NOW + 9_000, NOW)).toBe('00:09')
  })

  it('arredonda para cima: 1,2 s restantes ainda são 00:02, não 00:01', () => {
    // Arredondar para baixo faria o relógio mostrar 00:00 com um segundo inteiro de prazo pela
    // frente, e o card ainda aceitando clique — parece travado.
    expect(remainingLabel(NOW + 1_200, NOW)).toBe('00:02')
    expect(remainingLabel(NOW + 1, NOW)).toBe('00:01')
  })

  it('prazo vencido para em 00:00 em vez de ir para negativo ou sumir', () => {
    expect(remainingLabel(NOW, NOW)).toBe('00:00')
    expect(remainingLabel(NOW - 30_000, NOW)).toBe('00:00')
  })

  it('gate sem prazo não tem relógio', () => {
    // `expiresAt: null` é o gate de pergunta (`ask_user_question`), que espera o usuário sem teto.
    expect(remainingLabel(null, NOW)).toBeNull()
  })

  it('expiresAt não finito não vira relógio quebrado', () => {
    expect(remainingLabel(Number.NaN, NOW)).toBeNull()
    expect(remainingLabel(Number.POSITIVE_INFINITY, NOW)).toBeNull()
  })
})

describe('isCountdownWarning (F30)', () => {
  it('fica muted acima de 15 s e amber a partir de 15 s', () => {
    expect(isCountdownWarning(NOW + PERMISSION_COUNTDOWN_WARN_MS + 1, NOW)).toBe(false)
    expect(isCountdownWarning(NOW + PERMISSION_COUNTDOWN_WARN_MS, NOW)).toBe(true)
    expect(isCountdownWarning(NOW + 3_000, NOW)).toBe(true)
  })

  it('continua amber depois de vencido', () => {
    expect(isCountdownWarning(NOW - 1, NOW)).toBe(true)
  })

  it('gate sem prazo nunca alarma', () => {
    expect(isCountdownWarning(null, NOW)).toBe(false)
    expect(isCountdownWarning(Number.NaN, NOW)).toBe(false)
  })
})
