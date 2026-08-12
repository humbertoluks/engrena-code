import { describe, expect, it } from 'vitest'
import {
  CHAT_MIN_WIDTH,
  chatWidthAt,
  collapsePanel,
  expandPanel,
  isForcedRail,
  LEFT_RAIL_BREAKPOINT,
  PANEL_WIDTH,
  type PanelPrefs,
  RAIL_WIDTH,
  RIGHT_RAIL_BREAKPOINT,
  resolveLayout,
} from './responsiveLayout.logic.js'

const OPEN: PanelPrefs = { leftCollapsed: false, rightCollapsed: false }

/** minWidth/tamanho inicial reais da BrowserWindow. */
const MIN_WINDOW_WIDTH = 960
const DEFAULT_WINDOW_WIDTH = 1280

describe('breakpoints derivados', () => {
  it('a direita cede antes da esquerda', () => {
    expect(RIGHT_RAIL_BREAKPOINT).toBeGreaterThan(LEFT_RAIL_BREAKPOINT)
  })

  it('a janela mínima já nasce com as duas laterais em trilho', () => {
    expect(LEFT_RAIL_BREAKPOINT).toBeGreaterThan(MIN_WINDOW_WIDTH)
  })

  it('o tamanho inicial da janela mantém as três colunas', () => {
    const layout = resolveLayout({ width: DEFAULT_WINDOW_WIDTH, prefs: OPEN, overlay: null })
    expect(layout).toMatchObject({ left: 'column', right: 'column' })
    expect(chatWidthAt(DEFAULT_WINDOW_WIDTH, layout)).toBeGreaterThanOrEqual(CHAT_MIN_WIDTH)
  })
})

describe('resolveLayout — sequência de recolhimento', () => {
  it.each([
    [1400, 'column', 'column'],
    [RIGHT_RAIL_BREAKPOINT, 'column', 'column'],
    [RIGHT_RAIL_BREAKPOINT - 1, 'column', 'rail'],
    [LEFT_RAIL_BREAKPOINT, 'column', 'rail'],
    [LEFT_RAIL_BREAKPOINT - 1, 'rail', 'rail'],
    [MIN_WINDOW_WIDTH, 'rail', 'rail'],
  ])('em %ipx: projetos=%s, direita=%s', (width, left, right) => {
    expect(resolveLayout({ width, prefs: OPEN, overlay: null })).toMatchObject({ left, right })
  })

  it('a conversa nunca fica abaixo do piso em nenhuma largura possível', () => {
    for (let width = MIN_WINDOW_WIDTH; width <= 2560; width += 1) {
      const layout = resolveLayout({ width, prefs: OPEN, overlay: null })
      expect(chatWidthAt(width, layout)).toBeGreaterThanOrEqual(CHAT_MIN_WIDTH)
    }
  })

  it('escreve as colunas do grid', () => {
    expect(resolveLayout({ width: 1400, prefs: OPEN, overlay: null }).gridTemplateColumns).toBe(
      `${PANEL_WIDTH}px 1fr ${PANEL_WIDTH}px`
    )
    expect(
      resolveLayout({ width: MIN_WINDOW_WIDTH, prefs: OPEN, overlay: null }).gridTemplateColumns
    ).toBe(`${RAIL_WIDTH}px 1fr ${RAIL_WIDTH}px`)
  })
})

describe('resolveLayout — preferência x imposição', () => {
  it('preferência recolhe mesmo com espaço de sobra', () => {
    const layout = resolveLayout({
      width: 1600,
      prefs: { leftCollapsed: true, rightCollapsed: false },
      overlay: null,
    })
    expect(layout).toMatchObject({ left: 'rail', right: 'column', leftForced: false })
  })

  it('marca como imposto só o lado que a largura recolheu', () => {
    const layout = resolveLayout({ width: RIGHT_RAIL_BREAKPOINT - 1, prefs: OPEN, overlay: null })
    expect(layout).toMatchObject({ leftForced: false, rightForced: true })
  })

  it('alargar a janela devolve a coluna que o usuário tinha aberta', () => {
    const prefs = OPEN
    expect(resolveLayout({ width: MIN_WINDOW_WIDTH, prefs, overlay: null }).right).toBe('rail')
    expect(resolveLayout({ width: 1400, prefs, overlay: null }).right).toBe('column')
  })
})

describe('resolveLayout — sobreposição', () => {
  it('mantém o drawer enquanto o lado for trilho', () => {
    expect(resolveLayout({ width: MIN_WINDOW_WIDTH, prefs: OPEN, overlay: 'right' }).overlay).toBe(
      'right'
    )
  })

  it('descarta o drawer quando o lado volta a caber como coluna', () => {
    expect(resolveLayout({ width: 1600, prefs: OPEN, overlay: 'right' }).overlay).toBeNull()
  })
})

describe('expandPanel', () => {
  it('com espaço, vira coluna e grava a preferência', () => {
    const result = expandPanel('right', 1600, { leftCollapsed: false, rightCollapsed: true })
    expect(result).toEqual({
      prefs: { leftCollapsed: false, rightCollapsed: false },
      overlay: null,
    })
  })

  it('sem espaço, abre sobreposto e não toca na preferência', () => {
    const prefs: PanelPrefs = { leftCollapsed: false, rightCollapsed: false }
    expect(expandPanel('left', MIN_WINDOW_WIDTH, prefs)).toEqual({ prefs, overlay: 'left' })
  })
})

describe('collapsePanel', () => {
  it('fechar o drawer não grava preferência', () => {
    const prefs: PanelPrefs = { leftCollapsed: false, rightCollapsed: false }
    expect(collapsePanel('right', prefs, 'right')).toEqual({ prefs, overlay: null })
  })

  it('recolher uma coluna grava preferência', () => {
    expect(collapsePanel('left', OPEN, null)).toEqual({
      prefs: { leftCollapsed: true, rightCollapsed: false },
      overlay: null,
    })
  })
})

describe('isForcedRail', () => {
  it('usa o limite de cada lado', () => {
    expect(isForcedRail('right', RIGHT_RAIL_BREAKPOINT)).toBe(false)
    expect(isForcedRail('right', RIGHT_RAIL_BREAKPOINT - 1)).toBe(true)
    expect(isForcedRail('left', RIGHT_RAIL_BREAKPOINT - 1)).toBe(false)
  })
})
