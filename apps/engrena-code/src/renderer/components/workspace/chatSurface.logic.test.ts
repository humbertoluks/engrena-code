import { describe, expect, it } from 'vitest'
import type { ThreadState } from '../../services/threads-service'
import { routeComposerSend } from './composerRoute.logic'
import { CHAT_SURFACE_COPY, deriveChatSurface, type ChatSurfaceInput } from './chatSurface.logic'

const ALL_STATES: Array<ThreadState | null> = [
  'running',
  'idle',
  'committed',
  'error',
  'stopping',
  'waiting_user',
  'waiting_permission',
  'cancelled',
  null,
]

const base: ChatSurfaceInput = {
  threadState: 'idle',
  hasPendingPermission: false,
  hasPendingQuestion: false,
  hasActivePending: false,
  queueLength: 0,
  hasSelectedThread: true,
  hasSelectedProject: true,
  draftText: 'oi',
}

const BOOLS = [false, true]
const TEXTS = ['', '   ', 'oi', 'Sim', 'Permitir todos', 'Negar', 'talvez depois']

function allInputs(): ChatSurfaceInput[] {
  const out: ChatSurfaceInput[] = []
  for (const threadState of ALL_STATES) {
    for (const hasPendingPermission of BOOLS) {
      for (const hasPendingQuestion of BOOLS) {
        for (const hasSelectedThread of BOOLS) {
          for (const hasSelectedProject of BOOLS) {
            for (const draftText of TEXTS) {
              out.push({
                ...base,
                threadState,
                hasPendingPermission,
                hasPendingQuestion,
                hasSelectedThread,
                hasSelectedProject,
                draftText,
              })
            }
          }
        }
      }
    }
  }
  return out
}

describe('deriveChatSurface — rota é a de routeComposerSend, nunca reimplementada', () => {
  it('devolve exatamente a mesma action para toda a matriz estado × flags × texto', () => {
    const cases = allInputs()
    // Guarda contra a matriz encolher em silêncio.
    expect(cases.length).toBe(ALL_STATES.length * 2 * 2 * 2 * 2 * TEXTS.length)

    for (const input of cases) {
      const expected = routeComposerSend({
        text: input.draftText,
        threadState: input.threadState,
        hasPendingPermission: input.hasPendingPermission,
        hasPendingQuestion: input.hasPendingQuestion,
        hasSelectedThread: input.hasSelectedThread,
        hasSelectedProject: input.hasSelectedProject,
      }).action
      expect({ input, route: deriveChatSurface(input).route }).toEqual({ input, route: expected })
    }
  })
})

describe('deriveChatSurface — modo', () => {
  it('stopping vence tudo', () => {
    expect(
      deriveChatSurface({ ...base, threadState: 'stopping', hasPendingPermission: true }).composerMode
    ).toBe('stopping')
  })

  it('permissão pendente vence running e waiting_user', () => {
    expect(
      deriveChatSurface({ ...base, threadState: 'running', hasPendingPermission: true }).composerMode
    ).toBe('permission')
    expect(
      deriveChatSurface({ ...base, threadState: 'waiting_user', hasPendingPermission: true }).composerMode
    ).toBe('permission')
  })

  it('waiting_permission é modo permissão mesmo com a fila local vazia (WS perdido)', () => {
    expect(deriveChatSurface({ ...base, threadState: 'waiting_permission' }).composerMode).toBe('permission')
  })

  it('waiting_user vira question e running vira busy', () => {
    expect(deriveChatSurface({ ...base, threadState: 'waiting_user' }).composerMode).toBe('question')
    expect(deriveChatSurface({ ...base, threadState: 'running' }).composerMode).toBe('busy')
  })

  it('estados assentados são idle', () => {
    for (const state of ['idle', 'committed', 'error', 'cancelled', null] as const) {
      expect(deriveChatSurface({ ...base, threadState: state }).composerMode).toBe('idle')
    }
  })
})

describe('deriveChatSurface — Parar e Enviar', () => {
  it('running mostra Parar e Enviar (o Enviar enfileira)', () => {
    const surface = deriveChatSurface({ ...base, threadState: 'running' })
    expect(surface.showStop).toBe(true)
    expect(surface.showSend).toBe(true)
    expect(surface.route).toBe('enqueue')
    expect(surface.sendLabel).toBe(CHAT_SURFACE_COPY.sendEnqueue)
  })

  it('stopping mostra só Parar', () => {
    const surface = deriveChatSurface({ ...base, threadState: 'stopping' })
    expect(surface.showStop).toBe(true)
    expect(surface.showSend).toBe(false)
  })

  it('permissão pendente com a thread já parada ainda mostra Parar', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle', hasPendingPermission: true }).showStop).toBe(true)
  })

  it('thread parada sem permissão não mostra Parar', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).showStop).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: null }).showStop).toBe(false)
  })
})

describe('deriveChatSurface — rótulo acompanha a rota', () => {
  it('waiting_user sem pergunta pendente rotula enfileirar, não "Enviar resposta"', () => {
    const surface = deriveChatSurface({ ...base, threadState: 'waiting_user', hasPendingQuestion: false })
    expect(surface.route).toBe('enqueue')
    expect(surface.sendLabel).toBe(CHAT_SURFACE_COPY.sendEnqueue)
  })

  it('waiting_user com pergunta pendente rotula resposta', () => {
    const surface = deriveChatSurface({ ...base, threadState: 'waiting_user', hasPendingQuestion: true })
    expect(surface.route).toBe('answer_question')
    expect(surface.sendLabel).toBe(CHAT_SURFACE_COPY.sendQuestion)
  })

  it('decisão de permissão e bloqueio rotulam permissão', () => {
    expect(
      deriveChatSurface({
        ...base,
        threadState: 'waiting_permission',
        hasPendingPermission: true,
        draftText: 'Sim',
      }).sendLabel
    ).toBe(CHAT_SURFACE_COPY.sendPermission)
    expect(
      deriveChatSurface({ ...base, threadState: 'waiting_permission', draftText: 'qualquer coisa' }).sendLabel
    ).toBe(CHAT_SURFACE_COPY.sendPermission)
  })

  it('composer vazio cai no rótulo do modo', () => {
    expect(deriveChatSurface({ ...base, threadState: 'running', draftText: '' }).route).toBe('noop')
    expect(deriveChatSurface({ ...base, threadState: 'running', draftText: '' }).sendLabel).toBe(
      CHAT_SURFACE_COPY.sendEnqueue
    )
    expect(deriveChatSurface({ ...base, threadState: 'idle', draftText: '   ' }).sendLabel).toBe(
      CHAT_SURFACE_COPY.send
    )
    expect(
      deriveChatSurface({ ...base, threadState: 'waiting_permission', draftText: '' }).sendLabel
    ).toBe(CHAT_SURFACE_COPY.sendPermission)
  })

  it('thread nova rotula Enviar', () => {
    const surface = deriveChatSurface({ ...base, threadState: null, hasSelectedThread: false })
    expect(surface.route).toBe('send_new')
    expect(surface.sendLabel).toBe(CHAT_SURFACE_COPY.send)
  })
})

describe('deriveChatSurface — placeholder', () => {
  it('mapeia cada modo para a sua chave', () => {
    expect(deriveChatSurface({ ...base, threadState: 'stopping' }).placeholderKey).toBe('stopping')
    expect(deriveChatSurface({ ...base, threadState: 'waiting_permission' }).placeholderKey).toBe('permission')
    expect(deriveChatSurface({ ...base, threadState: 'waiting_user' }).placeholderKey).toBe('question')
    expect(deriveChatSurface({ ...base, threadState: 'running' }).placeholderKey).toBe('running')
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).placeholderKey).toBe('follow_up')
    expect(
      deriveChatSurface({ ...base, threadState: null, hasSelectedThread: false }).placeholderKey
    ).toBe('new')
  })
})

describe('deriveChatSurface — indicador de atividade', () => {
  it('fica visível o turno inteiro em running', () => {
    expect(deriveChatSurface({ ...base, threadState: 'running' }).showActivity).toBe(true)
  })

  it('some quando a bola passa para o usuário', () => {
    expect(
      deriveChatSurface({ ...base, threadState: 'running', hasPendingPermission: true }).showActivity
    ).toBe(false)
    expect(
      deriveChatSurface({ ...base, threadState: 'running', hasPendingQuestion: true }).showActivity
    ).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'waiting_user' }).showActivity).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'waiting_permission' }).showActivity).toBe(false)
  })

  it('some com a thread parada ou cancelando', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).showActivity).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'stopping' }).showActivity).toBe(false)
  })
})

describe('deriveChatSurface — followups', () => {
  it('some com a thread ocupada', () => {
    for (const state of ['running', 'stopping', 'waiting_user', 'waiting_permission'] as const) {
      expect(deriveChatSurface({ ...base, threadState: state }).showFollowups).toBe(false)
    }
  })

  it('some com permissão ou pergunta pendente mesmo com a thread parada', () => {
    expect(deriveChatSurface({ ...base, hasPendingPermission: true }).showFollowups).toBe(false)
    expect(deriveChatSurface({ ...base, hasPendingQuestion: true }).showFollowups).toBe(false)
  })

  it('some com bolha otimista em voo', () => {
    expect(deriveChatSurface({ ...base, hasActivePending: true }).showFollowups).toBe(false)
  })

  it('aparece com a thread parada e nada em voo', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).showFollowups).toBe(true)
    expect(deriveChatSurface({ ...base, threadState: 'committed' }).showFollowups).toBe(true)
  })
})

describe('deriveChatSurface — sendStartsTurn', () => {
  it('decisão de permissão, resposta e enfileiramento passam por cima dos gates do projeto', () => {
    expect(deriveChatSurface({ ...base, hasPendingPermission: true }).sendStartsTurn).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'waiting_permission' }).sendStartsTurn).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'waiting_user' }).sendStartsTurn).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'running' }).sendStartsTurn).toBe(false)
  })

  it('thread parada abre turno novo e respeita os gates', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).sendStartsTurn).toBe(true)
    expect(deriveChatSurface({ ...base, threadState: null, hasSelectedThread: false }).sendStartsTurn).toBe(
      true
    )
  })
})

describe('deriveChatSurface — runtimeLocked', () => {
  it('trava com turno em andamento', () => {
    for (const state of ['running', 'stopping', 'waiting_user', 'waiting_permission'] as const) {
      expect(deriveChatSurface({ ...base, threadState: state }).runtimeLocked).toBe(true)
    }
  })

  it('trava com fila não-vazia mesmo parada', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle', queueLength: 1 }).runtimeLocked).toBe(true)
  })

  it('permissão pendente sozinha não trava provider/anexos', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle', hasPendingPermission: true }).runtimeLocked).toBe(
      false
    )
  })

  it('livre com thread parada e fila vazia', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).runtimeLocked).toBe(false)
  })
})
