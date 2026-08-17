import { describe, expect, it } from 'vitest'
import type { StreamEvent } from '../services/ws-client'
import {
  activeGate,
  GATE_ERROR_COPY,
  gateErrorMessage,
  gateFromOpenedEvent,
  permissionFromGate,
  questionFromGate,
  removeGate,
  upsertGate,
  type ThreadGate,
} from './threadGate.logic'

function permissionGate(overrides: Partial<ThreadGate> = {}): ThreadGate {
  return {
    gateId: 'gate_1',
    threadId: 'thr_1',
    kind: 'permission',
    toolName: 'Bash',
    payload: { command: 'ls' },
    createdAt: 1,
    expiresAt: 2,
    ...overrides,
  }
}

function questionGate(overrides: Partial<ThreadGate> = {}): ThreadGate {
  return {
    gateId: 'gate_q',
    threadId: 'thr_1',
    kind: 'question',
    toolName: null,
    payload: { prompt: 'Qual caminho?', options: ['A', 'B'], multiSelect: false },
    createdAt: 3,
    expiresAt: null,
    ...overrides,
  }
}

describe('gateFromOpenedEvent', () => {
  it('traduz o evento do wire sem perder campo', () => {
    const event: Extract<StreamEvent, { type: 'gate.opened' }> = {
      type: 'gate.opened',
      threadId: 'thr_1',
      gateId: 'gate_1',
      kind: 'permission',
      toolName: 'Write',
      payload: { file_path: 'a.ts' },
      createdAt: 10,
      expiresAt: 20,
    }
    expect(gateFromOpenedEvent(event)).toEqual({
      gateId: 'gate_1',
      threadId: 'thr_1',
      kind: 'permission',
      toolName: 'Write',
      payload: { file_path: 'a.ts' },
      createdAt: 10,
      expiresAt: 20,
    })
  })
})

describe('upsertGate / removeGate', () => {
  it('ignora o mesmo gateId chegando duas vezes (snapshot + replay do reconnect)', () => {
    const list = [permissionGate()]
    expect(upsertGate(list, permissionGate())).toBe(list)
  })

  it('acrescenta gate novo no fim (ordem de abertura)', () => {
    expect(upsertGate([permissionGate()], questionGate()).map((g) => g.gateId)).toEqual(['gate_1', 'gate_q'])
  })

  it('remove por gateId e devolve a mesma referência quando não havia o que remover', () => {
    const list = [permissionGate(), questionGate()]
    expect(removeGate(list, 'gate_1').map((g) => g.gateId)).toEqual(['gate_q'])
    expect(removeGate(list, 'gate_inexistente')).toBe(list)
  })
})

describe('activeGate', () => {
  it('sem gate aberto ninguém espera decisão', () => {
    expect(activeGate([])).toBeNull()
  })

  it('mostra o mais antigo — o resto é fila', () => {
    const gates = [permissionGate(), questionGate()]
    expect(activeGate(gates)?.gateId).toBe('gate_1')
  })
})

describe('questionFromGate', () => {
  it('normaliza prompt, opções e multiSelect', () => {
    expect(questionFromGate(questionGate())).toEqual({
      prompt: 'Qual caminho?',
      options: ['A', 'B'],
      multiSelect: false,
    })
  })

  it('checkpoint de pipeline (payload nulo) vira card sem chips, não crash', () => {
    expect(questionFromGate(questionGate({ payload: null }))).toEqual({
      prompt: '',
      options: [],
      multiSelect: false,
    })
  })

  it('descarta opção que não é string e lê multiSelect', () => {
    const gate = questionGate({ payload: { prompt: 1, options: ['A', 2, null], multiSelect: true } })
    expect(questionFromGate(gate)).toEqual({ prompt: '', options: ['A'], multiSelect: true })
  })

  it('não responde por gate de permissão nem por ausência de gate', () => {
    expect(questionFromGate(permissionGate())).toBeNull()
    expect(questionFromGate(null)).toBeNull()
  })
})

describe('permissionFromGate', () => {
  it('leva o toolName real e os params para o card', () => {
    expect(permissionFromGate(permissionGate())).toEqual({ toolName: 'Bash', params: { command: 'ls' } })
  })

  it('sem toolName cai em unknown em vez de quebrar a copy', () => {
    expect(permissionFromGate(permissionGate({ toolName: null }))?.toolName).toBe('unknown')
  })

  it('não confunde com gate de pergunta', () => {
    expect(permissionFromGate(questionGate())).toBeNull()
    expect(permissionFromGate(null)).toBeNull()
  })
})

describe('gateErrorMessage', () => {
  it('409 definitivos não mandam tentar de novo', () => {
    expect(gateErrorMessage('gate_not_found')).toBe(GATE_ERROR_COPY.gone)
    expect(gateErrorMessage('gate_thread_mismatch')).toBe(GATE_ERROR_COPY.otherThread)
  })

  it('outro código mostra a mensagem do servidor', () => {
    expect(gateErrorMessage('validation_error', 'Corpo inválido.')).toBe('Corpo inválido.')
  })

  it('sem código nem mensagem cai no genérico', () => {
    expect(gateErrorMessage(undefined)).toBe(GATE_ERROR_COPY.generic)
    expect(gateErrorMessage('boom', '')).toBe(GATE_ERROR_COPY.generic)
  })
})
