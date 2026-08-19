import { randomBytes } from 'crypto'
import http from 'http'
import { createLogEntry } from '../db/repositories/log-entries.js'
import { getProject } from '../db/repositories/projects.js'
import { getThread } from '../db/repositories/threads.js'
import { allowToolForProject, isToolAllowedForProject } from '../db/repositories/tool-allowlist.js'
import { commandScope, isCoveredByAllowlist, keysToGrant } from './bash-command-scope.js'
import { PERMISSION_BODY_MAX_BYTES } from './buffer-cap.js'
import {
  GATE_REASON_THREAD_CANCELLED,
  GATE_REASON_USER_DECISION,
  openPermissionGate,
  PERMISSION_TIMEOUT_MS,
  type PermissionGateDecision,
  type PermissionRequestInfo,
} from './gate.js'
import { permissionPolicyOutcome, type PermissionPolicyReason } from './permission-policy.js'
import { resolveThreadCwd } from './thread-cwd.js'
import type { BrokerPermissionOutcome } from './providers/permission-contract.js'

/**
 * Transporte do gate de permissão, nada mais: servidor HTTP loopback efêmero por turno + política
 * de auto-allow + allowlist da thread. O estado "há um gate aberto" (fila, timeout, resolução,
 * `threads.state`) é do `gate.ts`, dono único desse fato.
 */
export { PERMISSION_TIMEOUT_MS }
export type { PermissionRequestInfo }

/**
 * Allowlist por thread — equivalente Claude Code "Yes, don't ask again" pelo resto da sessão do
 * processo. A chave **não** é mais só o nome da tool: para shell ela é o verbo do comando
 * (`Bash(git *)`, ver `bash-command-scope.ts`), porque conceder um `git status` concedia o shell
 * inteiro, `rm -rf` incluído. A chave larga (`Bash`) continua válida e continua cobrindo tudo —
 * é o que as concessões anteriores a esta mudança gravaram.
 */
const allowedToolsByThread = new Map<string, Set<string>>()

/** Tudo menos `never-requested`, que é ausência de registro e por isso nunca é gravado. */
type RecordedBrokerOutcome = Exclude<BrokerPermissionOutcome, 'never-requested'>

/**
 * O que **este** broker respondeu ao hook, por tool, no turno corrente. É o único lugar do processo
 * que sabe o fato, e sem ele o diagnóstico da negação nativa mente:
 *
 * - `granted` — os três caminhos de `allow` do servidor: política do nível, allowlist ("Permitir
 *   todos") e decisão do usuário no card. O card apareceu (ou nem precisou), e quem negou depois
 *   foi outro hook da cadeia `PreToolUse`, sobre o qual o nível de acesso não tem efeito nenhum;
 * - `denied` — o usuário negou no card;
 * - `expired` — o gate fechou sem resposta do usuário (timeout fail-closed) e a tool foi negada
 *   por omissão;
 * - `cancelled` — o gate fechou porque o turno foi cancelado com o card ainda aberto;
 * - `unavailable` — o EngrenaCode nem conseguiu abrir o pedido (`gate_not_persisted`) e negou por
 *   falha interna, sem chegar a perguntar;
 * - `ambiguous` — a mesma tool recebeu decisões de sentidos opostos neste turno (ver
 *   `mergeBrokerOutcome`);
 * - sem entrada: o CLI negou sem nunca consultar o broker e nenhum card apareceu.
 *
 * Distinguir `denied` de "sem entrada" é o defeito R09: as duas superfícies acusavam o CLI de ter
 * negado por conta própria uma tool que o próprio usuário tinha acabado de recusar no card.
 *
 * Escopo de turno: `createPermissionServer` roda uma vez por turno e zera o mapa, porque decisão de
 * turno anterior não explica a negação do turno atual.
 *
 * Duas chaves por decisão, e a razão de existirem as duas:
 *
 * - **`tool_use_id`** — a chave exata. O CLI manda `tool_use_id` no payload do `PreToolUse` (junto
 *   de `tool_name`/`tool_input`) e manda o mesmo id na negação que chega pelo stream. Com ele, a
 *   decisão é atribuída à chamada certa, mesmo que a tool apareça várias vezes no turno;
 * - **`toolName`** — a chave agregada, que continua existindo porque nem toda negação traz id
 *   (payload de host antigo, evento sem o campo). É o fallback, e quando duas chamadas do mesmo
 *   nome discordam entre si, `mergeBrokerOutcome` marca `ambiguous` em vez de deixar a última
 *   vencer em silêncio — mentir com a decisão da chamada errada seria pior que admitir a dúvida.
 */
const brokerOutcomesByThread = new Map<string, Map<string, RecordedBrokerOutcome>>()

/** `granted` é o único sentido positivo; todo o resto negou, por um motivo ou outro. */
function isPositiveOutcome(outcome: RecordedBrokerOutcome): boolean {
  return outcome === 'granted'
}

/**
 * Última decisão vence, **exceto** quando ela contradiz a anterior: aí a entrada vira `ambiguous`.
 *
 * A chave é o `toolName`, não a chamada, porque é só isso que o hook manda. Sobrescrever em
 * silêncio faria a negação nativa afirmar a decisão da chamada errada — trocar uma mentira por
 * outra. `ambiguous` é o único valor honesto quando a mesma tool foi liberada numa chamada e
 * negada em outra dentro do mesmo turno.
 */
function mergeBrokerOutcome(
  previous: RecordedBrokerOutcome | undefined,
  next: RecordedBrokerOutcome
): RecordedBrokerOutcome {
  if (previous === undefined || previous === next) return next
  if (previous === 'ambiguous') return 'ambiguous'
  return isPositiveOutcome(previous) === isPositiveOutcome(next) ? next : 'ambiguous'
}

/** Prefixo da chave exata: o id vem do CLI e não pode colidir com um `toolName`. */
function toolUseKey(toolUseId: string): string {
  return `id:${toolUseId}`
}

/**
 * Grava a decisão nas duas chaves. A exata (`tool_use_id`) é sobrescrita direto — cada id é uma
 * chamada só, então não há conflito a resolver; a agregada (`toolName`) passa pelo merge, que é
 * onde a ambiguidade entre chamadas homônimas aparece.
 */
function recordBrokerOutcome(
  threadId: string,
  toolName: string,
  outcome: RecordedBrokerOutcome,
  toolUseId?: string
): void {
  let byKey = brokerOutcomesByThread.get(threadId)
  if (!byKey) {
    byKey = new Map()
    brokerOutcomesByThread.set(threadId, byKey)
  }
  if (toolUseId !== undefined) byKey.set(toolUseKey(toolUseId), outcome)
  byKey.set(toolName, mergeBrokerOutcome(byKey.get(toolName), outcome))
}

/**
 * Só `user_decision` é resposta do usuário. O resto fecha o gate sem ele e nega por omissão, mas
 * `thread_cancelled` merece caso próprio: mandar "responda ao card enquanto ele está na tela"
 * para quem acabou de apertar Parar é conselho para o problema errado.
 */
function outcomeForGateDecision(decision: PermissionGateDecision): RecordedBrokerOutcome {
  if (decision.allow) return 'granted'
  if (decision.reason === GATE_REASON_USER_DECISION) return 'denied'
  return decision.reason === GATE_REASON_THREAD_CANCELLED ? 'cancelled' : 'expired'
}

/**
 * Consumido por `dispatch.ts` ao diagnosticar `permission-native-denial`.
 *
 * O `toolUseId` da negação manda quando existe dos dois lados: é a decisão daquela chamada, não a
 * agregada do nome. Só cai para o nome quando o id falta (ou quando o pedido chegou sem ele).
 */
export function brokerOutcomeForTool(
  threadId: string,
  toolName: string,
  toolUseId?: string
): BrokerPermissionOutcome {
  const byKey = brokerOutcomesByThread.get(threadId)
  if (byKey === undefined) return 'never-requested'
  if (toolUseId !== undefined) {
    const exact = byKey.get(toolUseKey(toolUseId))
    if (exact !== undefined) return exact
  }
  return byKey.get(toolName) ?? 'never-requested'
}

/**
 * Turnos em que algum `POST /permission` estourou `PERMISSION_BODY_MAX_BYTES`.
 *
 * Esse caminho responde 413 no `data`, antes de existir corpo parseado — não há `toolName` a que
 * associar a rejeição, então a tool fica `never-requested`, indistinguível de "o CLI nunca
 * consultou o broker". Guardar o fato por thread não resolve a atribuição, mas deixa o diagnóstico
 * admitir a dúvida em vez de afirmar com certeza a versão errada.
 */
const oversizedRequestsByThread = new Set<string>()

function recordOversizedPermissionRequest(threadId: string): void {
  oversizedRequestsByThread.add(threadId)
}

/** Consumido por `dispatch.ts` para ressalvar o diagnóstico de negação nativa. */
export function hadOversizedPermissionRequest(threadId: string): boolean {
  return oversizedRequestsByThread.has(threadId)
}

export function clearBrokerOutcomesForThread(threadId: string): void {
  brokerOutcomesByThread.delete(threadId)
  oversizedRequestsByThread.delete(threadId)
}

/**
 * Raiz efetiva da thread para o julgamento de caminho (F31): o worktree quando a thread roda em
 * worktree, senão o path do projeto. É a mesma função que decide o `cwd` do turno — se as duas
 * divergissem, a política estaria medindo o comando contra uma raiz onde ele nem roda.
 *
 * `null` quando a thread ou o projeto sumiram: sem raiz não há como julgar, e sem julgamento o
 * comando cai no card.
 */
function effectiveThreadRoot(threadId: string): string | null {
  const thread = getThread(threadId)
  if (thread === null) return null
  const project = getProject(thread.projectId)
  if (project === null) return null
  return resolveThreadCwd(thread, project)
}

/**
 * Auto-aprovação de shell é a única classe de `allow` que depende de análise nossa — as tools de
 * arquivo são liberadas por uma lista de nomes, esta é liberada por um parser. Quando o parser
 * errar, este registro é o que permite descobrir por quê.
 *
 * Grava caminho resolvido, nunca a linha de comando: o comando pode carregar segredo em argumento,
 * e o que interessa à auditoria é o que foi tocado.
 */
function logShellAutoApproval(
  threadId: string,
  reason: Extract<PermissionPolicyReason, { kind: 'shell-file-edit' | 'shell-read' }>
): void {
  // Escrita e leitura ficam distinguíveis no Registros: são riscos diferentes, e quem for auditar
  // um `allow` indevido precisa saber de qual dos dois estágios ele saiu.
  const [rotulo, verbos] =
    reason.kind === 'shell-file-edit'
      ? ['escreveu sem card', reason.verb]
      : ['leu sem card', reason.verbs.join(' | ')]
  // A frase carrega a própria preposição: verbo sem caminho (`ls`) dizia "em o diretório do turno",
  // que é o tipo de erro que só aparece quando alguém lê o Registros de verdade.
  const alvo =
    reason.paths.length === 0 ? 'no diretório do turno' : `em ${reason.paths.join(', ')}`
  try {
    createLogEntry({
      threadId,
      kind: 'tool',
      event: `Auto-accept edits ${rotulo}: ${verbos} ${alvo} (raiz ${reason.root}).`,
    })
  } catch {
    // Log é acessório; falha aqui não pode derrubar a resposta ao hook, que tem um CLI esperando.
  }
}

export interface PermissionServerHandle {
  port: number
  token: string
  close: () => void
}

export interface PermissionServerOptions {
  /** Override do fail-closed (testes usam ms curtos). Default: `PERMISSION_TIMEOUT_MS`. */
  timeoutMs?: number
}

/**
 * Esta chamada já está liberada? `params` entra porque o escopo do shell é o verbo do comando,
 * não o nome da tool — sem ele, `Bash` só poderia ser tudo ou nada.
 *
 * Consulta a allowlist da thread (memória, esta sessão) e a do projeto (`tool_allowlist`,
 * sobrevive ao restart) pela mesma chave.
 */
export function isToolAllowedForThread(threadId: string, toolName: string, params?: unknown): boolean {
  const scope = commandScope(toolName, params)
  const threadSet = allowedToolsByThread.get(threadId)
  const thread = getThread(threadId)
  return isCoveredByAllowlist(scope, (key) => {
    if (threadSet?.has(key) === true) return true
    return thread !== null && isToolAllowedForProject(thread.projectId, key)
  })
}

/** Claude Code "don't ask again" — grava as chaves desta concessão na sessão da thread. */
export function rememberAllowedTool(threadId: string, ...keys: string[]): void {
  let set = allowedToolsByThread.get(threadId)
  if (!set) {
    set = new Set()
    allowedToolsByThread.set(threadId, set)
  }
  for (const key of keys) set.add(key)
}

export function clearAllowedToolsForThread(threadId: string): void {
  allowedToolsByThread.delete(threadId)
}

/**
 * Servidor HTTP loopback efêmero por turno — recebe o `POST /permission` do hook `PreToolUse`
 * (spawnado pelo CLI via `--settings`, ver `providers/claude/permission-settings.ts`), abre um gate em `gate.ts` e segura a
 * resposta até o gate ser resolvido/expirado, devolvendo `{allow}` pro hook decidir
 * `permissionDecision: allow|deny`.
 *
 * Auto-allow sem gate quando: (1) `permission-policy.ts` já decide `allow` — full-access inteiro,
 * leitura/edição em auto-accept-edits, e desde F31 também o comando de shell que mexe em arquivo
 * (ou só lê) dentro da raiz da thread — ou (2) tool já está na allowlist da thread ("Permitir
 * todos" / don't ask again). Só os casos de shell gravam log: são os únicos `allow` que saem de um
 * parser nosso, e escrita e leitura aparecem com rótulos diferentes.
 *
 * Fail-closed em todo caminho de erro: body acima do cap, gate que não persiste (thread apagada
 * mid-turn) e timeout respondem `allow:false`.
 *
 * `onRequest` é só notificação para o chamador; `waiting_permission`, `gate.opened` e
 * `permission.request` já saem de dentro de `openPermissionGate`.
 */
export function createPermissionServer(
  threadId: string,
  onRequest?: (info: PermissionRequestInfo) => void,
  options?: PermissionServerOptions
): Promise<PermissionServerHandle> {
  const token = randomBytes(24).toString('hex')
  const timeoutMs = options?.timeoutMs ?? PERMISSION_TIMEOUT_MS
  // Um servidor por turno: zerar aqui é o que dá escopo de turno às decisões.
  clearBrokerOutcomesForThread(threadId)

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/permission') {
      res.writeHead(404)
      res.end()
      return
    }
    if (req.headers['x-permission-token'] !== token) {
      res.writeHead(403)
      res.end()
      return
    }

    let body = ''
    let bodyBytes = 0
    let overCap = false
    // Derrubar a conexão emite 'error' (ECONNRESET) no request; sem listener o stream lançaria.
    req.on('error', () => {
      /* corpo abortado pelo cap ou conexão morta — nada pendente a resolver */
    })
    req.on('data', (chunk: Buffer) => {
      if (overCap) return
      bodyBytes += chunk.length
      if (bodyBytes > PERMISSION_BODY_MAX_BYTES) {
        overCap = true
        // Fail-closed: seguir com body parcial daria JSON inválido → toolName 'unknown' no modal.
        // Sem `toolName` não dá para registrar a decisão por tool; o que sobra é marcar o turno.
        recordOversizedPermissionRequest(threadId)
        res.writeHead(413, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: false, error: 'payload_too_large' }), () => {
          req.destroy()
        })
        return
      }
      body += chunk.toString()
    })
    req.on('end', () => {
      if (overCap) return
      let parsed: { toolName?: unknown; toolInput?: unknown; toolUseId?: unknown } = {}
      try {
        parsed = JSON.parse(body || '{}')
      } catch {
        parsed = {}
      }

      const toolName = typeof parsed.toolName === 'string' ? parsed.toolName : 'unknown'
      const toolUseId =
        typeof parsed.toolUseId === 'string' && parsed.toolUseId !== '' ? parsed.toolUseId : undefined

      const current = getThread(threadId)
      // Sem thread (apagada mid-turn) cai no mais restrito — nunca libera por omissão.
      const accessLevel = current?.accessLevel ?? 'supervised'
      // `toolInput` e a raiz entram porque em `auto-accept-edits` a política julga o comando, não
      // só o nome da tool (F31): `mkdir src/novo` dentro do projeto passa, `rm -rf build` não.
      const outcome = permissionPolicyOutcome(accessLevel, toolName, {
        params: parsed.toolInput,
        root: current === null ? null : effectiveThreadRoot(threadId),
      })
      if (outcome.decision === 'allow') {
        if (outcome.reason.kind === 'shell-file-edit' || outcome.reason.kind === 'shell-read') {
          logShellAutoApproval(threadId, outcome.reason)
        }
        recordBrokerOutcome(threadId, toolName, 'granted', toolUseId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: true }))
        return
      }

      if (isToolAllowedForThread(threadId, toolName, parsed.toolInput)) {
        recordBrokerOutcome(threadId, toolName, 'granted', toolUseId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: true }))
        return
      }

      const opened = openPermissionGate({ threadId, toolName, params: parsed.toolInput, timeoutMs })
      if (!opened.ok) {
        // Negado sem nunca chegar ao usuário: registrar como `unavailable` é o que impede o
        // diagnóstico de culpar o CLI (ou o usuário) por uma falha nossa.
        recordBrokerOutcome(threadId, toolName, 'unavailable', toolUseId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: false }))
        return
      }

      onRequest?.(opened.gate)
      opened.decision.then((decision) => {
        recordBrokerOutcome(threadId, toolName, outcomeForGateDecision(decision), toolUseId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: decision.allow }))
      })
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
          server.close()
        },
      })
    })
  })
}

/** `thread` grava só na sessão da thread; `project` também persiste em `tool_allowlist`. */
export type PermissionScope = 'thread' | 'project'

/**
 * "Permitir todos" — efeito do `always=true` no `POST /permission`. Fica aqui, e não no `gate.ts`,
 * porque allowlist é assunto do broker; o gate só chama isto pelo hook `onGranted` (o que também
 * evita ciclo de import entre os dois módulos).
 *
 * `params` é o payload da chamada concedida: é dele que sai o verbo do shell. Sem ele a concessão
 * volta a ser a tool inteira — o comportamento antigo, mantido de propósito para o caso em que o
 * comando não tem verbo nomeável (`./deploy.sh`, `$(…)`).
 */
export function grantAlwaysAllowedTool(
  threadId: string,
  toolName: string,
  scope: PermissionScope,
  params?: unknown
): void {
  const keys = keysToGrant(commandScope(toolName, params))
  rememberAllowedTool(threadId, ...keys)
  if (scope !== 'project') return
  const thread = getThread(threadId)
  if (thread === null) return
  for (const key of keys) allowToolForProject(thread.projectId, key)
}
