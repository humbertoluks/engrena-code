import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { ButtonSecondary } from '../components/ButtonSecondary'
import { InlineFeedback } from '../components/InlineFeedback'
import type { FeedbackVariant } from '../components/InlineFeedback'
import { SegmentedControl } from '../components/SegmentedControl'
import { StatusDot } from '../components/StatusDot'
import type { DotVariant } from '../components/StatusDot'
import { Card, CardHeader } from '../components/Card'
import { Badge } from '../components/Badge'
import { Field } from '../components/Field'
import {
  configuracaoService,
  type CLIStatusData,
  type ConfigStatus,
  type ProviderKeyName,
} from '../services/configuracao-service'

// ── Copy ─────────────────────────────────────────────────────────────────────

const COPY = {
  pageTitle: 'Configuração',
  pageSubtitle:
    'Credenciais salvas localmente no userData do app (filesystem). Nenhuma chave sai deste dispositivo.',

  claudeTitle: 'Autenticação do Claude',
  claudeSubtitle:
    'Escolha como o Claude autentica. Na assinatura, sua key salva fica como fallback inerte e nunca cobra a API sozinha; em API key, a key do cofre passa a cobrar por uso.',
  claudeTestCta: 'Testar conexão',
  claudeTestLoading: 'Testando...',
  claudeStatusOk: '✓ Usando a assinatura (Claude Code) — sem cobrança de API.',
  claudeStatusMissing:
    'Assinatura selecionada, mas não detectei login do Claude Code. Rode `claude` no terminal para autenticar.',
  claudeStatusApiKeyWarn: '⚠ Usando API key — isto cobra por uso da API Anthropic.',
  claudeApiKeyDisabledHint: 'Salve uma key Claude abaixo para habilitar.',
  claudeStatusApiKeyNoKey: 'Nenhuma key salva: os turnos vão falhar. Volte para Assinatura ou salve a key abaixo.',
  claudeTestError: 'Não foi possível testar a conexão agora.',

  clisTitle: 'CLIs de assinatura',
  clisSubtitle:
    'Claude, Codex e Kimi usam a assinatura dos respectivos CLIs — sem API key. O app herda a sessão autenticada.',
  clisTestCta: 'Testar conexões',
  clisTestLoading: 'Testando…',
  clisHintClaude: 'Rode `claude` (login no primeiro uso) no terminal para autenticar.',
  clisHintCodex: 'Rode `codex login` no terminal para autenticar.',
  clisHintKimi: 'Rode `kimi login` no terminal para autenticar.',
  clisHintNotInstalled: (loginCmd: string) =>
    `Instale o CLI e rode \`${loginCmd}\` para autenticar.`,
  clisNotInstalled: 'não instalado',
  clisInstalled: 'instalado',
  clisLoggedIn: 'logado (assinatura)',
  clisNotLoggedIn: 'não logado',
  clisLoggedInUnknown: 'estado desconhecido — clique em Testar',

  promptTitle: 'System prompt global do harness',
  promptSubtitle:
    'Instruções injetadas antes do prompt da thread, em todos os providers. Esvazie e salve para desligar; "Restaurar padrão" volta ao texto do EngrenaCode.',
  promptSaveCta: 'Salvar prompt global',
  promptSaveLoading: 'Salvando…',
  promptRestoreCta: 'Restaurar padrão',
  promptBadgeDefault: 'Usando o padrão do EngrenaCode.',
  promptBadgeCustom: 'Customizado.',
  promptDotActive: 'Ativo',
  promptDotOff: 'Desligado',

  githubTitle: 'Token do GitHub',
  githubSubtitle: 'Personal access token usado pelo git flow ao abrir PRs (ou via CLI gh).',
  githubLabel: 'Personal access token',
  githubPlaceholder: 'ghp_…',
  githubHint: 'Escopos recomendados: `repo`, `workflow`.',
  githubSaveCta: 'Salvar token',
  githubSaveLoading: 'Salvando...',
  githubReveal: 'Revelar token',
  githubHide: 'Ocultar token',
  githubBadgePresent: 'Customizado',
  githubBadgeEmpty: 'Não configurado',

  keysTitle: 'API keys dos providers',
  keysSubtitle:
    'Claude, Codex e Minimax guardam a key no cofre local. Claude só cobra em modo API key (na assinatura a key fica inerte). Codex e Minimax usam a key quando configurada.',
  keysSaveCta: 'Salvar chaves',
  keysSaveLoading: 'Salvando...',
  keysSuccess: 'Chaves salvas localmente (não validadas com o provider).',
  keysBadgeConfigured: 'configurada',
  keysBadgeMissing: 'não configurada',
  keysLabelClaude: 'Claude',
  keysPlaceholderClaude: 'sk-ant-…',
  keysErrorClaudeFormat: 'Formato inválido. Esperado: sk-ant-…',
  keysLabelCodex: 'Codex',
  keysPlaceholderCodex: 'sk-codex-…',
  keysErrorCodexFormat: 'Formato inválido. Esperado: sk-… ou sk-codex-…',
  keysLabelMinimax: 'Minimax',
  keysPlaceholderMinimax: 'mm-…',
  keysErrorSpaces: 'A chave não pode conter espaços.',
  keysErrorShort: 'Chave muito curta para ser válida.',
  keysErrorNetwork: 'Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução.',
  keysErrorGeneric: 'Não foi possível salvar. Tente novamente.',
  keysReveal: (label: string) => `Revelar ${label}`,
  keysHide: (label: string) => `Ocultar ${label}`,
} as const

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT_BASE =
  'w-full rounded-sm border border-border bg-surface-2 px-md py-sm text-sm text-fg font-mono transition-colors placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'

const TEXTAREA_BASE =
  'w-full rounded-sm border border-border bg-surface-2 px-md py-sm text-sm text-fg font-mono leading-relaxed transition-colors placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 resize-y disabled:opacity-50'

// ── Sub-components (defined outside parent to satisfy rerender-no-inline-components) ──

interface Feedback {
  variant: FeedbackVariant
  message: string
}

// ── Claude Card ───────────────────────────────────────────────────────────────

interface ClaudeCardProps {
  mode: 'subscription' | 'api-key'
  subscriptionOk: boolean
  hasApiKey: boolean
  onModeChange: (mode: 'subscription' | 'api-key') => Promise<void>
  onTest: () => Promise<void>
  testLoading: boolean
  feedback: Feedback | null
}

function claudeModeOptions(hasApiKey: boolean): Array<{ value: string; label: string; disabled?: boolean; disabledTitle?: string }> {
  return [
    { value: 'subscription', label: 'Assinatura' },
    {
      value: 'api-key',
      label: 'API key',
      disabled: !hasApiKey,
      disabledTitle: hasApiKey ? undefined : COPY.claudeApiKeyDisabledHint,
    },
  ]
}

function claudeDot(mode: 'subscription' | 'api-key', subscriptionOk: boolean): DotVariant {
  if (mode === 'subscription') return subscriptionOk ? 'ok' : 'warn'
  return 'warn'
}

function claudeStatusMessage(mode: 'subscription' | 'api-key', subscriptionOk: boolean): string {
  if (mode === 'subscription') {
    return subscriptionOk ? COPY.claudeStatusOk : COPY.claudeStatusMissing
  }
  return COPY.claudeStatusApiKeyWarn
}

function ClaudeCard({
  mode,
  subscriptionOk,
  hasApiKey,
  onModeChange,
  onTest,
  testLoading,
  feedback,
}: Readonly<ClaudeCardProps>): ReactElement {
  const dot = claudeDot(mode, subscriptionOk)
  const statusMsg = claudeStatusMessage(mode, subscriptionOk)
  const showNoKeyWarning = mode === 'api-key' && !hasApiKey

  return (
    <Card>
      <CardHeader
        title={COPY.claudeTitle}
        subtitle={COPY.claudeSubtitle}
        dot={dot}
        dotTitle={dot === 'ok' ? 'Autenticado' : 'Não autenticado'}
      />
      <div className="flex flex-col gap-md">
        <SegmentedControl
          name="Claude auth mode"
          options={claudeModeOptions(hasApiKey)}
          value={mode}
          onChange={(v) => { void onModeChange(v as 'subscription' | 'api-key') }}
        />
        <p className={`text-[12.5px] ${dot === 'ok' ? 'text-green' : 'text-amber'}`}>
          {statusMsg}
        </p>
        {showNoKeyWarning ? (
          <p className="text-[12.5px] text-red">{COPY.claudeStatusApiKeyNoKey}</p>
        ) : null}
        <div className="flex items-center gap-md">
          <ButtonPrimary loading={testLoading} loadingLabel={COPY.claudeTestLoading} onClick={() => { void onTest() }}>
            {COPY.claudeTestCta}
          </ButtonPrimary>
          {feedback !== null ? <InlineFeedback variant={feedback.variant} message={feedback.message} /> : null}
        </div>
      </div>
    </Card>
  )
}

// ── CLI Row ────────────────────────────────────────────────────────────────────

interface CliRowProps {
  name: string
  label: string
  status: CLIStatusData | null
  loginHint: string
  notInstalledHint: string
}

function cliDot(status: CLIStatusData | null): DotVariant {
  if (status === null) return 'unknown'
  if (!status.installed) return 'off'
  if (status.loggedIn === null) return 'unknown'
  return status.loggedIn ? 'ok' : 'warn'
}

function cliStatusLabel(status: CLIStatusData | null): string {
  if (status === null) return COPY.clisLoggedInUnknown
  if (!status.installed) return COPY.clisNotInstalled
  if (status.loggedIn === null) return COPY.clisLoggedInUnknown
  return status.loggedIn ? COPY.clisLoggedIn : COPY.clisNotLoggedIn
}

function CliRow({ name, label, status, loginHint, notInstalledHint }: Readonly<CliRowProps>): ReactElement {
  const dot = cliDot(status)
  const statusLabel = cliStatusLabel(status)
  const showLoginHint = status?.installed && status.loggedIn === false
  const showNotInstalledHint = status !== null && !status.installed

  return (
    <div className="grid grid-cols-[140px_1fr_auto] items-start gap-sm py-sm">
      <span className="text-[13.5px] font-medium text-fg">{label}</span>
      <div className="flex flex-col gap-[2px]">
        <div className="flex items-center gap-xs">
          <StatusDot variant={dot} />
          <span className="text-[12.5px] text-muted">{statusLabel}</span>
        </div>
        {status?.path !== undefined ? (
          <span className="font-mono text-[11.5px] text-muted">{status.path}</span>
        ) : null}
        {showLoginHint ? (
          <span className="text-[11.5px] text-amber">{loginHint}</span>
        ) : null}
        {showNotInstalledHint ? (
          <span className="text-[11.5px] text-muted">{notInstalledHint}</span>
        ) : null}
      </div>
      <span className="text-[11.5px] text-muted" aria-label={`${name} instalado`}>
        {status?.installed ? COPY.clisInstalled : ''}
      </span>
    </div>
  )
}

// ── CLIs Card ─────────────────────────────────────────────────────────────────

interface CLIsCardProps {
  clis: ConfigStatus['clis'] | null
  onTest: () => Promise<void>
  testLoading: boolean
  feedback: Feedback | null
}

function CLIsCard({ clis, onTest, testLoading, feedback }: Readonly<CLIsCardProps>): ReactElement {
  return (
    <Card>
      <CardHeader title={COPY.clisTitle} subtitle={COPY.clisSubtitle} />
      <div className="mb-md flex items-center gap-md">
        <ButtonPrimary loading={testLoading} loadingLabel={COPY.clisTestLoading} onClick={() => { void onTest() }}>
          {COPY.clisTestCta}
        </ButtonPrimary>
        {feedback !== null ? <InlineFeedback variant={feedback.variant} message={feedback.message} /> : null}
      </div>
      <div className="divide-y divide-border">
        <CliRow
          name="claude"
          label="Claude"
          status={clis?.claude ?? null}
          loginHint={COPY.clisHintClaude}
          notInstalledHint={COPY.clisHintNotInstalled('claude')}
        />
        <CliRow
          name="codex"
          label="Codex"
          status={clis?.codex ?? null}
          loginHint={COPY.clisHintCodex}
          notInstalledHint={COPY.clisHintNotInstalled('codex login')}
        />
        <CliRow
          name="kimi"
          label="Kimi"
          status={clis?.kimi ?? null}
          loginHint={COPY.clisHintKimi}
          notInstalledHint={COPY.clisHintNotInstalled('kimi login')}
        />
      </div>
    </Card>
  )
}

// ── Prompt Card ───────────────────────────────────────────────────────────────

interface PromptCardProps {
  isDefault: boolean
  isEmpty: boolean
  serverText: string
  onSave: (text: string) => Promise<void>
  onRestore: () => Promise<void>
  saveLoading: boolean
  restoreLoading: boolean
  feedback: Feedback | null
}

function PromptCard({
  isDefault,
  isEmpty,
  serverText,
  onSave,
  onRestore,
  saveLoading,
  restoreLoading,
  feedback,
}: Readonly<PromptCardProps>): ReactElement {
  const [draft, setDraft] = useState(serverText)
  const serverTextRef = useRef(serverText)

  // Sync draft when server state changes (e.g. after restore)
  useEffect(() => {
    if (serverText !== serverTextRef.current) {
      setDraft(serverText)
      serverTextRef.current = serverText
    }
  }, [serverText])

  const isDirty = draft !== serverText
  const promptDot: DotVariant = isEmpty ? 'off' : 'ok'

  return (
    <Card>
      <CardHeader
        title={COPY.promptTitle}
        subtitle={COPY.promptSubtitle}
        dot={promptDot}
        dotTitle={isEmpty ? COPY.promptDotOff : COPY.promptDotActive}
      />
      <div className="flex flex-col gap-md">
        <textarea
          rows={14}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saveLoading || restoreLoading}
          className={TEXTAREA_BASE}
          aria-label="System prompt global"
        />
        <div className="flex items-center gap-xs">
          <span className="rounded-sm border border-border bg-surface-2 px-sm py-[3px] font-mono text-[11.5px] text-muted">
            {isDefault ? COPY.promptBadgeDefault : COPY.promptBadgeCustom}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <ButtonPrimary
            loading={saveLoading}
            loadingLabel={COPY.promptSaveLoading}
            disabled={!isDirty}
            onClick={() => { void onSave(draft) }}
          >
            {COPY.promptSaveCta}
          </ButtonPrimary>
          <ButtonSecondary
            loading={restoreLoading}
            disabled={isDefault || saveLoading}
            title={isDefault ? COPY.promptBadgeDefault : 'Descarta o texto customizado e volta ao padrão'}
            onClick={() => { void onRestore() }}
          >
            {COPY.promptRestoreCta}
          </ButtonSecondary>
          {feedback !== null ? <InlineFeedback variant={feedback.variant} message={feedback.message} /> : null}
        </div>
      </div>
    </Card>
  )
}

// ── Keys Card ─────────────────────────────────────────────────────────────────

function validateClaudeKeyLocal(v: string): string | null {
  if (v === '') return null
  if (/\s/.test(v)) return COPY.keysErrorSpaces
  if (v.length < 8) return COPY.keysErrorShort
  if (!v.startsWith('sk-ant-')) return COPY.keysErrorClaudeFormat
  return null
}

function validateCodexKeyLocal(v: string): string | null {
  if (v === '') return null
  if (/\s/.test(v)) return COPY.keysErrorSpaces
  if (v.length < 8) return COPY.keysErrorShort
  if (!v.startsWith('sk-')) return COPY.keysErrorCodexFormat
  return null
}

function validateMinimaxKeyLocal(v: string): string | null {
  if (v === '') return null
  if (/\s/.test(v)) return COPY.keysErrorSpaces
  if (v.length < 8) return COPY.keysErrorShort
  return null
}

interface KeyRowState {
  draft: string
  revealed: boolean
  error: string | null
}

function emptyKeyRow(): KeyRowState {
  return { draft: '', revealed: false, error: null }
}

interface KeyRowDef {
  name: ProviderKeyName
  label: string
  placeholder: string
  validate: (v: string) => string | null
}

const KEY_ROWS: KeyRowDef[] = [
  { name: 'claude', label: COPY.keysLabelClaude, placeholder: COPY.keysPlaceholderClaude, validate: validateClaudeKeyLocal },
  { name: 'codex', label: COPY.keysLabelCodex, placeholder: COPY.keysPlaceholderCodex, validate: validateCodexKeyLocal },
  { name: 'minimax', label: COPY.keysLabelMinimax, placeholder: COPY.keysPlaceholderMinimax, validate: validateMinimaxKeyLocal },
]

interface KeysCardProps {
  keysStatus: ConfigStatus['keys'] | null
  onSave: (fields: Partial<Record<ProviderKeyName, string>>) => Promise<void>
  saveLoading: boolean
  feedback: Feedback | null
}

function KeysCard({ keysStatus, onSave, saveLoading, feedback }: Readonly<KeysCardProps>): ReactElement {
  const [rows, setRows] = useState<Record<ProviderKeyName, KeyRowState>>({
    claude: emptyKeyRow(),
    codex: emptyKeyRow(),
    minimax: emptyKeyRow(),
  })

  const updateDraft = useCallback((name: ProviderKeyName, value: string): void => {
    setRows((prev) => ({ ...prev, [name]: { ...prev[name], draft: value, error: null } }))
  }, [])

  const toggleReveal = useCallback((name: ProviderKeyName): void => {
    setRows((prev) => ({ ...prev, [name]: { ...prev[name], revealed: !prev[name].revealed } }))
  }, [])

  const handleSave = useCallback((): void => {
    const errors: Partial<Record<ProviderKeyName, string>> = {}
    const fields: Partial<Record<ProviderKeyName, string>> = {}

    for (const row of KEY_ROWS) {
      const draft = rows[row.name].draft
      const err = row.validate(draft)
      if (err !== null) {
        errors[row.name] = err
        continue
      }
      if (draft !== '') fields[row.name] = draft
    }

    if (Object.keys(errors).length > 0) {
      setRows((prev) => {
        const next = { ...prev }
        for (const name of Object.keys(errors) as ProviderKeyName[]) {
          next[name] = { ...next[name], error: errors[name] ?? null }
        }
        return next
      })
      return
    }

    void onSave(fields)
  }, [rows, onSave])

  return (
    <Card>
      <CardHeader title={COPY.keysTitle} subtitle={COPY.keysSubtitle} />
      <div className="divide-y divide-border">
        {KEY_ROWS.map((row) => {
          const state = rows[row.name]
          const configured = keysStatus?.[row.name] ?? false
          return (
            <div
              key={row.name}
              className="grid grid-cols-1 items-start gap-sm py-sm min-[720px]:grid-cols-[140px_1fr_auto]"
            >
              <span className="text-[13.5px] font-medium text-fg">{row.label}</span>
              <Field
                id={`key-${row.name}`}
                ariaLabel={row.label}
                value={state.draft}
                onChange={(v) => updateDraft(row.name, v)}
                placeholder={configured ? '••••••••••••••••' : row.placeholder}
                revealed={state.revealed}
                onToggleReveal={() => toggleReveal(row.name)}
                revealLabel={COPY.keysReveal(row.label)}
                hideLabel={COPY.keysHide(row.label)}
                error={state.error}
              />
              <Badge tone={configured ? 'positive' : 'neutral'}>
                {configured ? COPY.keysBadgeConfigured : COPY.keysBadgeMissing}
              </Badge>
            </div>
          )
        })}
      </div>
      <div className="mt-md flex items-center gap-md">
        <ButtonPrimary loading={saveLoading} loadingLabel={COPY.keysSaveLoading} onClick={handleSave}>
          {COPY.keysSaveCta}
        </ButtonPrimary>
        {feedback !== null ? <InlineFeedback variant={feedback.variant} message={feedback.message} /> : null}
      </div>
    </Card>
  )
}

// ── GitHub Card ───────────────────────────────────────────────────────────────

const GITHUB_PREFIXES = ['ghp_', 'github_pat_', 'gho_', 'ghu_', 'ghs_', 'ghr_']
const HAS_SPACES_RE = /\s/

function validateGithubToken(token: string): string | null {
  if (token === '') return null
  if (HAS_SPACES_RE.test(token)) return 'A chave não pode conter espaços.'
  if (token.length < 8) return 'Chave muito curta para ser válida.'
  if (!GITHUB_PREFIXES.some((p) => token.startsWith(p))) {
    return 'Formato inválido. Esperado: ghp_… ou github_pat_…'
  }
  return null
}

interface GithubCardProps {
  tokenPresent: boolean
  onSave: (token: string) => Promise<void>
  saveLoading: boolean
  feedback: Feedback | null
}

function GithubCard({ tokenPresent, onSave, saveLoading, feedback }: Readonly<GithubCardProps>): ReactElement {
  const [tokenDraft, setTokenDraft] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSave = useCallback((): void => {
    const err = validateGithubToken(tokenDraft)
    if (err !== null) {
      setLocalError(err)
      return
    }
    setLocalError(null)
    void onSave(tokenDraft)
  }, [tokenDraft, onSave])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    setTokenDraft(e.target.value)
    if (localError !== null) setLocalError(null)
  }, [localError])

  const effectiveFeedback: Feedback | null = localError !== null
    ? { variant: 'error', message: localError }
    : feedback

  return (
    <Card>
      <CardHeader title={COPY.githubTitle} subtitle={COPY.githubSubtitle} />
      <div className="flex flex-col gap-md">
        <div className="flex flex-col gap-xs">
          <label htmlFor="github-token" className="text-sm font-medium text-fg">
            {COPY.githubLabel}
          </label>
          <div className="relative">
            <input
              id="github-token"
              type={revealed ? 'text' : 'password'}
              value={tokenDraft}
              onChange={handleChange}
              placeholder={tokenPresent ? '••••••••••••••••' : COPY.githubPlaceholder}
              aria-invalid={localError !== null || undefined}
              className={`${INPUT_BASE} pr-[40px] ${localError !== null ? 'border-red focus:border-red focus:ring-red/30' : ''}`}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              title={revealed ? COPY.githubHide : COPY.githubReveal}
              aria-label={revealed ? COPY.githubHide : COPY.githubReveal}
              className="absolute right-sm top-1/2 -translate-y-1/2 text-muted hover:text-fg"
            >
              {revealed ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[15px] w-[15px]" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[15px] w-[15px]" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] text-muted">{COPY.githubHint}</span>
            <span className="rounded-sm border border-border bg-surface-2 px-sm py-[3px] font-mono text-[11.5px] text-muted">
              {tokenPresent ? COPY.githubBadgePresent : COPY.githubBadgeEmpty}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <ButtonPrimary loading={saveLoading} loadingLabel={COPY.githubSaveLoading} onClick={handleSave}>
            {COPY.githubSaveCta}
          </ButtonPrimary>
          {effectiveFeedback !== null ? (
            <InlineFeedback variant={effectiveFeedback.variant} message={effectiveFeedback.message} />
          ) : null}
        </div>
      </div>
    </Card>
  )
}

// ── ConfiguracaoScreen ────────────────────────────────────────────────────────

interface ActionState {
  loading: boolean
  feedback: Feedback | null
}

function makeAction(): ActionState {
  return { loading: false, feedback: null }
}

export function ConfiguracaoScreen(): ReactElement {
  const [status, setStatus] = useState<ConfigStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [claudeAction, setClaudeAction] = useState<ActionState>(makeAction)
  const [clisAction, setClisAction] = useState<ActionState>(makeAction)
  const [promptAction, setPromptAction] = useState<ActionState>(makeAction)
  const [promptRestoreAction, setPromptRestoreAction] = useState<ActionState>(makeAction)
  const [githubAction, setGithubAction] = useState<ActionState>(makeAction)
  const [keysAction, setKeysAction] = useState<ActionState>(makeAction)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadStatus = useCallback(async (): Promise<void> => {
    try {
      const data = await configuracaoService.getStatus()
      if (mountedRef.current) {
        setStatus(data)
        setLoadError(null)
      }
    } catch {
      if (mountedRef.current) setLoadError('Não foi possível carregar a configuração.')
    }
  }, [])

  useEffect(() => { void loadStatus() }, [loadStatus])

  const handleClaudeMode = useCallback(async (mode: 'subscription' | 'api-key'): Promise<void> => {
    setClaudeAction({ loading: true, feedback: null })
    try {
      const res = await configuracaoService.setClaudeMode(mode)
      if (!mountedRef.current) return
      setStatus((prev) => prev === null ? prev : {
        ...prev,
        claude: { mode: res.mode as 'subscription' | 'api-key', subscriptionOk: res.subscriptionOk ?? false },
      })
      setClaudeAction({ loading: false, feedback: null })
    } catch {
      if (mountedRef.current) setClaudeAction({ loading: false, feedback: { variant: 'error', message: 'Não foi possível alterar o modo.' } })
    }
  }, [])

  const handleClaudeTest = useCallback(async (): Promise<void> => {
    setClaudeAction((prev) => ({ ...prev, loading: true, feedback: null }))
    try {
      const res = await configuracaoService.testClaude()
      if (!mountedRef.current) return
      setClaudeAction({
        loading: false,
        feedback: { variant: res.success ? 'success' : 'warn', message: res.detail },
      })
      if (res.success && status !== null) {
        setStatus((prev) => prev === null ? prev : {
          ...prev,
          claude: { ...prev.claude, subscriptionOk: true },
        })
      }
    } catch {
      if (mountedRef.current) setClaudeAction({ loading: false, feedback: { variant: 'error', message: COPY.claudeTestError } })
    }
  }, [status])

  const handleClisTest = useCallback(async (): Promise<void> => {
    setClisAction({ loading: true, feedback: null })
    try {
      const res = await configuracaoService.testClis()
      if (!mountedRef.current) return
      setStatus((prev) => prev === null ? prev : { ...prev, clis: res.results })
      setClisAction({ loading: false, feedback: { variant: 'info', message: res.summary } })
    } catch {
      if (mountedRef.current) setClisAction({ loading: false, feedback: { variant: 'error', message: 'Falha ao testar as conexões.' } })
    }
  }, [])

  const handlePromptSave = useCallback(async (text: string): Promise<void> => {
    const payload = text === '' ? null : text
    setPromptAction({ loading: true, feedback: null })
    try {
      const res = await configuracaoService.savePrompt(payload)
      if (!mountedRef.current) return
      setStatus((prev) => prev === null ? prev : {
        ...prev,
        prompt: { isDefault: res.isDefault, isEmpty: res.isEmpty, currentText: text === '' ? res.currentText : text },
      })
      setPromptAction({ loading: false, feedback: { variant: 'success', message: res.message } })
    } catch {
      if (mountedRef.current) setPromptAction({ loading: false, feedback: { variant: 'error', message: 'Falha ao salvar o prompt global.' } })
    }
  }, [])

  const handlePromptRestore = useCallback(async (): Promise<void> => {
    setPromptRestoreAction({ loading: true, feedback: null })
    try {
      const res = await configuracaoService.restorePrompt()
      if (!mountedRef.current) return
      setStatus((prev) => prev === null ? prev : {
        ...prev,
        prompt: { isDefault: res.isDefault, isEmpty: res.isEmpty, currentText: res.currentText },
      })
      setPromptRestoreAction({ loading: false, feedback: null })
      setPromptAction({ loading: false, feedback: { variant: 'success', message: res.message } })
    } catch {
      if (mountedRef.current) setPromptRestoreAction({ loading: false, feedback: { variant: 'error', message: 'Falha ao restaurar o prompt.' } })
    }
  }, [])

  const handleGithubSave = useCallback(async (token: string): Promise<void> => {
    setGithubAction({ loading: true, feedback: null })
    try {
      const res = await configuracaoService.saveGithubToken(token)
      if (!mountedRef.current) return
      if (res.error) {
        setGithubAction({ loading: false, feedback: { variant: 'error', message: res.error.message } })
        return
      }
      setStatus((prev) => prev === null ? prev : {
        ...prev,
        github: { tokenPresent: token !== '' },
      })
      setGithubAction({ loading: false, feedback: { variant: 'success', message: res.message ?? 'Token salvo.' } })
    } catch {
      if (mountedRef.current) setGithubAction({ loading: false, feedback: { variant: 'error', message: 'Não foi possível contatar o servidor local.' } })
    }
  }, [])

  const handleKeysSave = useCallback(async (fields: Partial<Record<ProviderKeyName, string>>): Promise<void> => {
    setKeysAction({ loading: true, feedback: null })
    try {
      const res = await configuracaoService.saveProviderKeys(fields)
      if (!mountedRef.current) return
      if (res.error) {
        setKeysAction({ loading: false, feedback: { variant: 'error', message: res.error.message || COPY.keysErrorGeneric } })
        return
      }
      setStatus((prev) => prev === null || res.keys === undefined ? prev : { ...prev, keys: res.keys })
      setKeysAction({ loading: false, feedback: { variant: 'success', message: res.message ?? COPY.keysSuccess } })
    } catch {
      if (mountedRef.current) setKeysAction({ loading: false, feedback: { variant: 'error', message: COPY.keysErrorNetwork } })
    }
  }, [])

  if (loadError !== null) {
    return (
      <section id="configuracao" className="mx-auto max-w-[760px] px-lg py-xl">
        <p role="alert" className="text-sm text-red">{loadError}</p>
        <button type="button" onClick={() => { void loadStatus() }} className="mt-sm text-sm text-accent underline">
          Tentar novamente
        </button>
      </section>
    )
  }

  const promptFeedback: Feedback | null = promptAction.feedback ?? promptRestoreAction.feedback

  return (
    <section id="configuracao" className="mx-auto max-w-[760px] px-lg py-xl">
      <h1 className="font-display text-[21px] font-semibold tracking-tight text-fg">
        {COPY.pageTitle}
      </h1>
      <p className="mt-xs text-[13.5px] text-muted">{COPY.pageSubtitle}</p>

      <div className="mt-lg grid grid-cols-1 gap-md">
        <ClaudeCard
          mode={status?.claude.mode ?? 'subscription'}
          subscriptionOk={status?.claude.subscriptionOk ?? false}
          hasApiKey={status?.keys.claude ?? false}
          onModeChange={handleClaudeMode}
          onTest={handleClaudeTest}
          testLoading={claudeAction.loading}
          feedback={claudeAction.feedback}
        />

        <CLIsCard
          clis={status?.clis ?? null}
          onTest={handleClisTest}
          testLoading={clisAction.loading}
          feedback={clisAction.feedback}
        />

        <PromptCard
          isDefault={status?.prompt.isDefault ?? true}
          isEmpty={status?.prompt.isEmpty ?? false}
          serverText={status?.prompt.currentText ?? ''}
          onSave={handlePromptSave}
          onRestore={handlePromptRestore}
          saveLoading={promptAction.loading}
          restoreLoading={promptRestoreAction.loading}
          feedback={promptFeedback}
        />

        <KeysCard
          keysStatus={status?.keys ?? null}
          onSave={handleKeysSave}
          saveLoading={keysAction.loading}
          feedback={keysAction.feedback}
        />

        <GithubCard
          tokenPresent={status?.github.tokenPresent ?? false}
          onSave={handleGithubSave}
          saveLoading={githubAction.loading}
          feedback={githubAction.feedback}
        />
      </div>
    </section>
  )
}
