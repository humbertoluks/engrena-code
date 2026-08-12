/**
 * Larguras do workspace: quem cede espaço quando a janela encolhe.
 *
 * A conversa é o produto; os painéis são apoio. Então nenhuma largura é escolhida "a olho":
 * fixamos o piso da conversa e derivamos dele os pontos em que cada painel vira trilho.
 *
 * Módulo puro — o hook (`useResponsiveLayout`) só liga isto ao ResizeObserver e ao localStorage.
 */

export type PanelSide = 'left' | 'right'
export type PanelMode = 'column' | 'rail'

/**
 * Piso da conversa. ~70 caracteres por linha a 13px é a faixa em que texto longo ainda se lê sem
 * cansaço, e é também onde o composer cabe com os controles de modelo/acesso em uma linha só.
 */
export const CHAT_MIN_WIDTH = 640

/** Painel aberto (Projetos e sidebar direita usam a mesma largura). */
export const PANEL_WIDTH = 280

/** Painel recolhido: só o botão de expandir. */
export const RAIL_WIDTH = 40

/** `p-sm` nas duas bordas do grid + os dois `gap-sm` entre colunas. */
export const LAYOUT_GUTTER = 32

/**
 * A sidebar direita cede primeiro: ela é referência (branch, vínculos, limites), não operação.
 * Abaixo desta largura, manter as duas colunas empurraria a conversa abaixo do piso.
 */
export const RIGHT_RAIL_BREAKPOINT = CHAT_MIN_WIDTH + PANEL_WIDTH * 2 + LAYOUT_GUTTER

/**
 * Projetos cede depois, já com a direita em trilho. Fica acima do `minWidth: 600` da janela de
 * propósito: em 960×600 (o menor tamanho possível) as duas laterais já são trilho.
 */
export const LEFT_RAIL_BREAKPOINT = CHAT_MIN_WIDTH + PANEL_WIDTH + RAIL_WIDTH + LAYOUT_GUTTER

export interface PanelPrefs {
  leftCollapsed: boolean
  rightCollapsed: boolean
}

export interface LayoutInput {
  /** Largura do container do grid, não da tela. */
  width: number
  prefs: PanelPrefs
  overlay: PanelSide | null
}

export interface LayoutResult {
  left: PanelMode
  right: PanelMode
  /** Trilho imposto pela largura, não escolhido pelo usuário — muda o que "expandir" significa. */
  leftForced: boolean
  rightForced: boolean
  overlay: PanelSide | null
  gridTemplateColumns: string
}

/** Largura em que cada lado deixa de caber como coluna. */
export function railBreakpoint(side: PanelSide): number {
  return side === 'right' ? RIGHT_RAIL_BREAKPOINT : LEFT_RAIL_BREAKPOINT
}

export function isForcedRail(side: PanelSide, width: number): boolean {
  return width < railBreakpoint(side)
}

function widthOf(mode: PanelMode): string {
  return mode === 'column' ? `${PANEL_WIDTH}px` : `${RAIL_WIDTH}px`
}

function withCollapsed(prefs: PanelPrefs, side: PanelSide, collapsed: boolean): PanelPrefs {
  return side === 'left'
    ? { ...prefs, leftCollapsed: collapsed }
    : { ...prefs, rightCollapsed: collapsed }
}

export function resolveLayout(input: LayoutInput): LayoutResult {
  const leftForced = isForcedRail('left', input.width)
  const rightForced = isForcedRail('right', input.width)

  const left: PanelMode = leftForced || input.prefs.leftCollapsed ? 'rail' : 'column'
  const right: PanelMode = rightForced || input.prefs.rightCollapsed ? 'rail' : 'column'

  // Sobreposição só existe sobre trilho: alargar a janela devolve a coluna e o drawer some sozinho,
  // sem deixar um painel flutuando por cima de outro igual.
  const overlaySide = input.overlay
  const overlay =
    overlaySide !== null && (overlaySide === 'left' ? left : right) === 'rail' ? overlaySide : null

  return {
    left,
    right,
    leftForced,
    rightForced,
    overlay,
    gridTemplateColumns: `${widthOf(left)} 1fr ${widthOf(right)}`,
  }
}

/** Largura que sobra para a conversa — o número que os breakpoints existem para proteger. */
export function chatWidthAt(width: number, layout: Pick<LayoutResult, 'left' | 'right'>): number {
  const sides =
    (layout.left === 'column' ? PANEL_WIDTH : RAIL_WIDTH) +
    (layout.right === 'column' ? PANEL_WIDTH : RAIL_WIDTH)
  return width - sides - LAYOUT_GUTTER
}

export interface PanelAction {
  prefs: PanelPrefs
  overlay: PanelSide | null
}

/**
 * Expandir. Com espaço, o painel volta a ser coluna e isso vira preferência. Sem espaço, abre
 * sobreposto: espiar um painel não pode custar o piso da conversa.
 */
export function expandPanel(side: PanelSide, width: number, prefs: PanelPrefs): PanelAction {
  if (isForcedRail(side, width)) return { prefs, overlay: side }
  return { prefs: withCollapsed(prefs, side, false), overlay: null }
}

/**
 * Recolher. Fechar um drawer nunca grava preferência — ali o trilho é imposição da largura, e
 * gravar faria a janela estreita apagar a escolha que o usuário fez na janela larga.
 */
export function collapsePanel(
  side: PanelSide,
  prefs: PanelPrefs,
  overlay: PanelSide | null
): PanelAction {
  if (overlay === side) return { prefs, overlay: null }
  return { prefs: withCollapsed(prefs, side, true), overlay: null }
}
