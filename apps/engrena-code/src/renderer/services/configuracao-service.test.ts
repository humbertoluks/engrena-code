import { describe, expect, it } from 'vitest'
import { isConfigStatus, type ConfigStatus } from './configuracao-service.js'

/** Payload real de `GET /api/config/status` com o cofre travado (HTTP 423). */
const VAULT_LOCKED = {
  error: { code: 'vault_locked', message: 'Cofre local travado. Desbloqueie antes de continuar.' },
}

const UNAUTHORIZED = {
  error: { code: 'unauthorized', message: 'Sessão inválida.' },
}

function statusFixture(): ConfigStatus {
  const provider = { available: true }
  return {
    claude: { mode: 'subscription', subscriptionOk: true },
    clis: {
      claude: { installed: true, loggedIn: true },
      codex: { installed: false, loggedIn: null },
      kimi: { installed: false, loggedIn: null },
    },
    prompt: { isDefault: true, isEmpty: false, currentText: '' },
    github: { tokenPresent: false },
    keys: { claude: false, codex: false, minimax: false, glm: false, grok: false },
    voice: { openai: false, groq: false },
    providers: {
      claude: provider,
      codex: provider,
      kimi: provider,
      minimax: provider,
      glm: provider,
      grok: provider,
    },
  }
}

describe('isConfigStatus', () => {
  it('aceita o status completo', () => {
    expect(isConfigStatus(statusFixture())).toBe(true)
  })

  it.each([
    ['cofre travado', VAULT_LOCKED],
    ['sessão inválida', UNAUTHORIZED],
  ])('rejeita o corpo de erro de %s', (_label, payload) => {
    expect(isConfigStatus(payload)).toBe(false)
  })

  it('rejeita objeto sem os campos que a UI lê no render', () => {
    const { voice, ...semVoice } = statusFixture()
    expect(voice).toBeDefined()
    expect(isConfigStatus(semVoice)).toBe(false)

    const { providers, ...semProviders } = statusFixture()
    expect(providers).toBeDefined()
    expect(isConfigStatus(semProviders)).toBe(false)
  })

  it.each([[null], [undefined], ['texto'], [42], [[]]])('rejeita %p', (payload) => {
    expect(isConfigStatus(payload)).toBe(false)
  })
})

describe('regressão: corpo de erro guardado como status', () => {
  /**
   * O composer lê `configStatus.voice.openai` durante o render (TaskComposer). Guardar o corpo de
   * erro como status fazia esse acesso lançar TypeError, e sem error boundary acima a janela do
   * Electron caía inteira. O guard é o que impede o payload de chegar ao estado.
   */
  it('o payload de cofre travado explodiria no acesso que a UI faz', () => {
    const guardado = VAULT_LOCKED as unknown as ConfigStatus
    expect(() => guardado.voice.openai).toThrow(TypeError)
    expect(isConfigStatus(VAULT_LOCKED)).toBe(false)
  })
})
