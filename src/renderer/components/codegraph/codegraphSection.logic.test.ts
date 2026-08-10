import { describe, expect, it } from 'vitest'
import { badgeLabel, badgeTitle } from './codegraphSection.logic'

describe('codegraphSection.logic', () => {
  describe('badgeLabel', () => {
    it('formats indexed with ageHours', () => {
      expect(badgeLabel('indexed', 3)).toBe('CodeGraph: indexado (3h atrás)')
      expect(badgeLabel('indexed', null)).toBe('CodeGraph: indexado (0h atrás)')
    })

    it('returns fixed labels for indexing, unsupported, error and missing', () => {
      expect(badgeLabel('indexing', null)).toBe('CodeGraph: indexando…')
      expect(badgeLabel('unsupported', null)).toBe('CodeGraph: não suportado')
      expect(badgeLabel('error', null)).toBe('erro')
      expect(badgeLabel('missing', null)).toBe('sem graph')
    })
  })

  describe('badgeTitle', () => {
    it('maps each status to its title string', () => {
      expect(badgeTitle('indexed')).toBe('CodeGraph pronto — o agente consulta o grafo de símbolos')
      expect(badgeTitle('indexing')).toBe('Indexação em andamento')
      expect(badgeTitle('unsupported')).toBe('CodeGraph: não suportado')
      expect(badgeTitle('missing')).toBe('CodeGraph ausente — clique para criar')
      expect(badgeTitle('error')).toBe('CodeGraph ausente — clique para criar')
    })
  })
})
