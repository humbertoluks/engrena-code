import { randomBytes } from 'crypto'
import http from 'http'
import { openQuestionGate, type GateAnswer } from './gate.js'

/** Nome qualificado como o provider CLI reporta a tool (mesmo padrão de `CALL_SUBAGENT_TOOL_NAME`/`LOAD_SKILL_TOOL_NAME`). */
export const ASK_USER_QUESTION_TOOL_NAME = 'mcp__engrenacode__ask_user_question'

export interface AskUserQuestionRequest {
  prompt: string
  options?: string[]
  multiSelect?: boolean
}

/** O fato "há pergunta pendente" e a resposta vivem no ThreadGate; aqui é só a forma da resposta. */
export type AskUserQuestionAnswer = GateAnswer

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

/** Corpo do `POST /ask` vira payload consultável do gate; corpo inválido não derruba a pergunta. */
function parseQuestion(body: string): unknown {
  try {
    return JSON.parse(body) as unknown
  } catch {
    return null
  }
}

/**
 * Servidor HTTP loopback efêmero por turno (mesmo padrão estrutural de
 * `delegate.ts:createDelegationServer`, F15) — mas em vez de responder de imediato, segura a
 * resposta HTTP do `POST /ask` em aberto até o gate de pergunta ser resolvido (`POST /answer` ou
 * `POST /gate/:gateId/resolve`) ou rejeitado (cancel/fim de turno).
 *
 * Este módulo é **só** o servidor: quem é dono do fato "esta thread espera decisão humana", de quem
 * responde primeiro e da persistência é `gate.ts`. Cada request abre o seu próprio gate, então duas
 * perguntas no mesmo turno coexistem em vez de a segunda sobrescrever a primeira.
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
      const opened = openQuestionGate({ threadId, question: parseQuestion(body) })
      if (!opened.ok) {
        // Fail-closed: sem gate persistido ninguém consegue responder — devolve erro em vez de
        // pendurar o `tools/call` do MCP filho até o fim do turno.
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            content: [{ type: 'text', text: 'Não foi possível registrar a pergunta para o usuário.' }],
            isError: true,
          })
        )
        return
      }

      opened.answer.then(
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
        // Só fecha o socket: expirar as perguntas pendentes é do chamador (`cancelThread` e o
        // `finally` do turno já rejeitam **antes** de fechar o server, para o /ask preso sair).
        close: () => server.close(),
      })
    })
  })
}
