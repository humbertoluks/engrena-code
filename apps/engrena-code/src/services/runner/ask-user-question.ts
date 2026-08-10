import { randomBytes } from 'crypto'
import http from 'http'

/** Nome qualificado como o provider CLI reporta a tool (mesmo padrão de `CALL_SUBAGENT_TOOL_NAME`/`LOAD_SKILL_TOOL_NAME`). */
export const ASK_USER_QUESTION_TOOL_NAME = 'mcp__engrenacode__ask_user_question'

export interface AskUserQuestionRequest {
  prompt: string
  options?: string[]
  multiSelect?: boolean
}

export interface AskUserQuestionAnswer {
  selectedOptions?: string[]
  freeText?: string | null
}

interface PendingQuestion {
  resolve: (answer: AskUserQuestionAnswer) => void
  reject: (reason: string) => void
}

/**
 * Ponte entre o `POST /ask` do MCP interno (dentro do turno) e o `POST /api/threads/:id/answer`
 * (fora do turno, disparado pela UI) — os dois HTTP handlers só compartilham o threadId, então
 * o resolver pendente vive num map em nível de módulo em vez de estado local do servidor.
 */
const pending = new Map<string, PendingQuestion>()

export interface AskUserQuestionServerHandle {
  port: number
  token: string
  close: () => void
}

function answerToText(answer: AskUserQuestionAnswer): string {
  const freeText = typeof answer.freeText === 'string' ? answer.freeText.trim() : ''
  if (freeText) return freeText
  return (answer.selectedOptions ?? []).join(', ')
}

/**
 * Registra um resolver pendente para `threadId` e devolve a Promise que resolve/rejeita quando
 * `resolveAskUserQuestion`/`rejectAskUserQuestion` for chamado — mesmo mapa `pending` do `POST
 * /ask` do MCP (F21), mas sem precisar de um request HTTP em aberto. Usado pelo checkpoint do
 * pipeline-runner (F22), que pausa fora de qualquer tool-call de um CLI ao vivo.
 */
export function waitForAnswer(threadId: string): Promise<AskUserQuestionAnswer> {
  return new Promise((resolve, reject) => {
    pending.set(threadId, {
      resolve,
      reject: (reason) => reject(new Error(reason)),
    })
  })
}

/**
 * Servidor HTTP loopback efêmero por turno (mesmo padrão estrutural de
 * `delegate.ts:createDelegationServer`, F15) — mas em vez de responder de imediato, segura a
 * resposta HTTP do `POST /ask` em aberto até `resolveAskUserQuestion`/`rejectAskUserQuestion`
 * ser chamado por um request externo desacoplado.
 */
export function createAskUserQuestionServer(threadId: string): Promise<AskUserQuestionServerHandle> {
  const token = randomBytes(24).toString('hex')

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/ask') {
      res.writeHead(404)
      res.end()
      return
    }
    if (req.headers['x-ask-token'] !== token) {
      res.writeHead(403)
      res.end()
      return
    }

    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      waitForAnswer(threadId).then(
        (answer) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ content: [{ type: 'text', text: answerToText(answer) }], isError: false }))
        },
        (err: Error) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ content: [{ type: 'text', text: err.message }], isError: true }))
        }
      )
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        token,
        close: () => {
          pending.delete(threadId)
          server.close()
        },
      })
    })
  })
}

/** No-op silencioso se não há pergunta pendente para a thread (ex.: resposta duplicada, app reiniciado). */
export function resolveAskUserQuestion(threadId: string, answer: AskUserQuestionAnswer): boolean {
  const entry = pending.get(threadId)
  if (!entry) return false
  pending.delete(threadId)
  entry.resolve(answer)
  return true
}

/** Usado no cleanup de cancelamento/erro do turno (`dispatch.ts` `finally`) para liberar o `POST /ask` preso. */
export function rejectAskUserQuestion(threadId: string, reason: string): boolean {
  const entry = pending.get(threadId)
  if (!entry) return false
  pending.delete(threadId)
  entry.reject(reason)
  return true
}

export function hasPendingQuestion(threadId: string): boolean {
  return pending.has(threadId)
}
