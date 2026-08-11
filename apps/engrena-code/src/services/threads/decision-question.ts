/**
 * Detecção da pergunta que fecha uma resposta do agente.
 *
 * Por que existe: a tool `ask_user_question` desenha botões no instante da pergunta, mas o modelo
 * frequentemente pergunta em prosa — e aí o usuário fica sem nada para clicar, esperando sugestões
 * que só chegam depois de outra chamada ao provider. Aqui a decisão sai do próprio texto, na hora,
 * sem modelo nenhum no caminho.
 *
 * Módulo puro: roda no runner (grava o bloco na mensagem) e é testável sem processo.
 */

/** Pergunta longa demais é discurso, não decisão — não vira botão. */
export const MAX_QUESTION_CHARS = 320
export const MAX_DECISION_OPTIONS = 4
export const MAX_OPTION_CHARS = 60

export interface DecisionQuestion {
  question: string
  options: string[]
}

/**
 * Verbos com que um agente pede autorização — a pergunta fechada mais comum no produto. Em inglês
 * também: o modelo responde no idioma que quiser, e a decisão não pode depender disso (visto ao
 * vivo, com o Claude fechando em "Proceed?" numa thread inteira em português).
 */
const YES_NO_OPENERS =
  /\b(posso|pode|podemos|devo|quer que eu|quer que|autoriza|autorizo|confirma|confirmo|prossigo|prosseguir|sigo|seguir|começo|começar|crio|criar|aplico|aplicar|rodo|rodar|instalo|instalar|continuo|continuar|faço|fazer|gero|gerar|apago|apagar|removo|remover|proceed|continue|confirm|should i|shall i|may i|can i|do you want me|want me to|go ahead|ok to|okay to|is that ok|sounds good)\b/i

const AFFIRMATIVE = 'Sim, pode prosseguir'
const NEGATIVE = 'Não, aguarde'

/** Linha de lista: `- x`, `* x`, `1. x`, `1) x`, `a) x`. */
const LIST_LINE = /^\s*(?:[-*•]|\(?[0-9a-z][.)])\s+(.{2,})$/i

function cleanOption(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/[.;]+$/, '')
    .trim()
    .slice(0, MAX_OPTION_CHARS)
}

/**
 * Alternativas que o próprio agente enumerou logo antes da pergunta. Só valem as da última lista
 * contígua: lista solta no meio da explicação não é o menu da decisão.
 */
function optionsFromList(lines: string[], questionIndex: number): string[] {
  const options: string[] = []
  for (let i = questionIndex - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (line.trim() === '') {
      if (options.length > 0) break
      continue
    }
    const match = LIST_LINE.exec(line)
    if (match === null) break
    const option = cleanOption(match[1])
    if (option !== '') options.unshift(option)
    if (options.length === MAX_DECISION_OPTIONS) break
  }
  return options.length >= 2 ? options : []
}

/** `Sim/Não`, `sim ou não`, `(s/n)` — o agente já disse que a resposta é binária. */
function looksYesNo(question: string): boolean {
  if (/\b(sim|não|nao)\b.{0,12}\b(ou|\/)\b.{0,12}\b(não|nao|sim)\b/i.test(question)) return true
  return YES_NO_OPENERS.test(question)
}

/**
 * Pedido de aprovação em forma de afirmação: o agente diz que está esperando, sem interrogação.
 * Só conta na última frase da resposta — no meio do texto é narração do que ele vai fazer.
 */
const APPROVAL_REQUEST =
  /\b(espero|esperando|aguardo|aguardando)\b.{0,30}\b(aprova(ção|r)|confirma(ção|r)|ok|sinal|luz verde|resposta|autoriza(ção|r))\b|\b(manda|mande|me manda|me mande|me avisa|me avise|avisa|avise|diga|confirma|confirme|autoriza|autorize)\b.{0,30}\b(ok|sim|sinal|quando|se|para|pra|prosseguir|continuar|seguir|avançar)\b|\b(waiting for|awaiting)\b.{0,20}\b(approval|confirmation|go[- ]?ahead|green light)\b|\b(let me know|say the word|give me the go[- ]?ahead)\b/i

function looksApprovalRequest(sentence: string): boolean {
  return APPROVAL_REQUEST.test(sentence)
}

/**
 * Última frase da resposta, quando ela é uma pergunta ao usuário. Pergunta no meio do texto não
 * conta: o agente que segue explicando depois dela não está esperando resposta.
 */
export function detectDecisionQuestion(text: string): DecisionQuestion | null {
  const trimmed = text.trim()
  if (trimmed === '') return null

  const lines = trimmed.split(/\r?\n/)
  let questionIndex = lines.length - 1
  while (questionIndex >= 0 && lines[questionIndex].trim() === '') questionIndex -= 1
  if (questionIndex < 0) return null

  const lastLine = lines[questionIndex].trim()
  // A decisão é a última frase da última linha, não a linha inteira.
  const sentences = lastLine.split(/(?<=[.!?])\s+/)
  const last = (sentences[sentences.length - 1] ?? lastLine).trim()
  if (last.length > MAX_QUESTION_CHARS) return null

  if (last.endsWith('?')) {
    const listed = optionsFromList(lines, questionIndex)
    if (listed.length >= 2) return { question: last, options: listed }
    if (looksYesNo(last)) return { question: last, options: [AFFIRMATIVE, NEGATIVE] }
    return null
  }

  // Pedido de aprovação sem ponto de interrogação ("Manda ok pra prosseguir.") — é a forma mais
  // comum do agente pedir autorização, e sem isto ela ficava sem botão nenhum.
  if (looksApprovalRequest(last)) return { question: last, options: [AFFIRMATIVE, NEGATIVE] }
  return null
}

export interface DecisionBlock {
  type: 'decision'
  question: string
  options: string[]
}

export function decisionBlock(decision: DecisionQuestion): DecisionBlock {
  return { type: 'decision', question: decision.question, options: decision.options }
}
