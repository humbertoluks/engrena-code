import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { ButtonPrimary } from '../ButtonPrimary'
import { ButtonSecondary } from '../ButtonSecondary'
import { mcpsService, type Mcp, type McpCreateInput, type McpTransport } from '../../services/mcps-service'
import {
  canSubmitMcpForm,
  envToLines,
  extractSecretRefs,
  headersToLines,
  isValidMcpName,
  parseArgsLines,
  parseEnvLines,
  parseHeadersLines,
} from './mcpForm.logic'

const COPY = {
  titleNew: 'Novo MCP',
  titleEdit: 'Editar MCP',
  labelName: 'Nome',
  hintName: 'Chave única global (vira a chave do mcpServers).',
  placeholderName: 'ex.: github-mcp',
  errorNameReserved: 'O nome "engrenacode" é reservado (broker interno).',
  errorNamePattern: 'Use minúsculas, dígitos, "_" e "-" (começando por letra ou dígito).',
  labelDescription: 'Descrição',
  hintDescription: 'Opcional.',
  placeholderDescription: 'ex.: acesso à API do GitHub',
  labelCategory: 'Categoria',
  hintCategory: 'Opcional — agrupa no menu.',
  placeholderCategory: 'ex.: integrações',
  labelTransport: 'Transporte',
  transportStdio: 'stdio (comando local)',
  transportHttp: 'http (url remota)',
  transportSse: 'sse (url remota)',
  labelCommand: 'Comando',
  hintCommand: 'Executável a spawnar (transporte stdio).',
  placeholderCommand: 'ex.: npx',
  labelArgs: 'Argumentos',
  hintArgs: 'Um argumento por linha.',
  labelEnv: 'Env',
  hintEnv:
    'Uma variável por linha, no formato KEY=VALUE — use vault:nome_da_chave para referenciar um segredo do cofre. Valores literais ficam em texto plano no banco local (SQLite) — valores sensíveis devem usar vault:<chave> (cifrado no cofre).',
  placeholderEnv: 'GITHUB_TOKEN=vault:github_token',
  secretsTitle: 'Segredos do cofre',
  secretsNote: 'O valor nunca é exibido — só o estado definido/vazio.',
  secretsBadgeDefined: 'definido',
  secretsBadgeEmpty: 'vazio',
  secretsPlaceholderReplace: 'substituir valor…',
  secretsPlaceholderEmpty: 'valor do segredo…',
  secretsCtaSave: 'Gravar',
  secretsCtaClear: 'Limpar',
  secretsError: 'Não foi possível gravar no cofre. Tente novamente.',
  labelUrl: 'URL',
  hintUrl: (transport: string) => `Endpoint do server (transporte ${transport}).`,
  placeholderUrl: 'https://mcp.exemplo.com/sse',
  labelHeaders: 'Headers',
  hintHeaders: 'Um header por linha, no formato "Nome: valor".',
  placeholderHeaders: 'Authorization: Bearer ...',
  toggleEnabled: 'Habilitado (toggle global)',
  warnCodex: 'No Codex, integrações MCP exigem Full access explícito; não há bypass ou desativação automática do sandbox.',
  ctaCancel: 'Cancelar',
  ctaCreate: 'Criar',
  ctaSave: 'Salvar',
  ctaLoading: 'Salvando...',
} as const

const LABEL_CLASS = 'text-[12px] font-semibold uppercase tracking-[0.04em] text-muted'
const INPUT_CLASS =
  'w-full rounded-sm border border-border bg-surface-2 px-md py-sm text-sm text-fg transition-colors placeholder:text-muted focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent'
const MONO_INPUT_CLASS = `${INPUT_CLASS} font-mono`
const TEXTAREA_CLASS = `${MONO_INPUT_CLASS} leading-relaxed resize-y`
const HINT_CLASS = 'text-[11.5px] text-muted'

export interface McpFormModalProps {
  mcp: Mcp | null
  saving: boolean
  errorMessage: string | null
  onSubmit: (input: McpCreateInput) => void
  onCancel: () => void
}

export function McpFormModal({ mcp, saving, errorMessage, onSubmit, onCancel }: Readonly<McpFormModalProps>): ReactElement {
  const isEdit = mcp !== null
  const [name, setName] = useState(mcp?.name ?? '')
  const [description, setDescription] = useState(mcp?.description ?? '')
  const [category, setCategory] = useState(mcp?.category ?? '')
  const [transport, setTransport] = useState<McpTransport>(mcp?.transport ?? 'stdio')
  const [command, setCommand] = useState(mcp?.command ?? '')
  const [argsText, setArgsText] = useState((mcp?.args ?? []).join('\n'))
  const [envText, setEnvText] = useState(envToLines(mcp?.env ?? {}))
  const [url, setUrl] = useState(mcp?.url ?? '')
  const [headersText, setHeadersText] = useState(headersToLines(mcp?.headers ?? {}))
  const [enabled, setEnabled] = useState(mcp?.enabled ?? true)

  const { env, errors: envErrors } = useMemo(() => parseEnvLines(envText), [envText])
  const { headers, errors: headerErrors } = useMemo(() => parseHeadersLines(headersText), [headersText])
  const secretRefs = useMemo(() => extractSecretRefs(env), [env])
  const nameValid = name === '' || isValidMcpName(name)

  const canSubmit = canSubmitMcpForm({ name, transport, command, url, envErrors, headerErrors }, saving)

  const handleSubmit = useCallback((): void => {
    if (!canSubmit) return
    onSubmit({
      name,
      description: description.trim() === '' ? null : description,
      category: category.trim() === '' ? null : category,
      transport,
      command: transport === 'stdio' ? command : null,
      args: transport === 'stdio' ? parseArgsLines(argsText) : [],
      env: transport === 'stdio' ? env : {},
      url: transport !== 'stdio' ? url : null,
      headers: transport !== 'stdio' ? headers : {},
      enabled,
    })
  }, [canSubmit, name, description, category, transport, command, argsText, env, url, headers, enabled, onSubmit])

  return (
    <div className="fixed inset-0 z-50 flex place-items-center justify-center bg-black/50 px-md">
      <div className="flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg shadow-lg">
        <h2 className="mb-md text-[17px] font-semibold text-fg">{isEdit ? COPY.titleEdit : COPY.titleNew}</h2>

        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label htmlFor="mcp-name" className={LABEL_CLASS}>{COPY.labelName}</label>
            <input
              id="mcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={COPY.placeholderName}
              disabled={saving}
              className={INPUT_CLASS}
              autoComplete="off"
            />
            <span className={HINT_CLASS}>{COPY.hintName}</span>
            {!nameValid ? (
              <span role="alert" className="text-[11.5px] text-red">
                {name === 'engrenacode' ? COPY.errorNameReserved : COPY.errorNamePattern}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="mcp-description" className={LABEL_CLASS}>{COPY.labelDescription}</label>
            <input
              id="mcp-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={COPY.placeholderDescription}
              disabled={saving}
              className={INPUT_CLASS}
              autoComplete="off"
            />
            <span className={HINT_CLASS}>{COPY.hintDescription}</span>
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="mcp-category" className={LABEL_CLASS}>{COPY.labelCategory}</label>
            <input
              id="mcp-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={COPY.placeholderCategory}
              disabled={saving}
              className={INPUT_CLASS}
              autoComplete="off"
            />
            <span className={HINT_CLASS}>{COPY.hintCategory}</span>
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="mcp-transport" className={LABEL_CLASS}>{COPY.labelTransport}</label>
            <select
              id="mcp-transport"
              value={transport}
              onChange={(e) => setTransport(e.target.value as McpTransport)}
              disabled={saving}
              className={INPUT_CLASS}
            >
              <option value="stdio">{COPY.transportStdio}</option>
              <option value="http">{COPY.transportHttp}</option>
              <option value="sse">{COPY.transportSse}</option>
            </select>
          </div>

          {transport === 'stdio' ? (
            <>
              <div className="flex flex-col gap-xs">
                <label htmlFor="mcp-command" className={LABEL_CLASS}>{COPY.labelCommand}</label>
                <input
                  id="mcp-command"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder={COPY.placeholderCommand}
                  disabled={saving}
                  className={MONO_INPUT_CLASS}
                  autoComplete="off"
                />
                <span className={HINT_CLASS}>{COPY.hintCommand}</span>
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="mcp-args" className={LABEL_CLASS}>{COPY.labelArgs}</label>
                <textarea
                  id="mcp-args"
                  rows={2}
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  disabled={saving}
                  className={TEXTAREA_CLASS}
                />
                <span className={HINT_CLASS}>{COPY.hintArgs}</span>
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="mcp-env" className={LABEL_CLASS}>{COPY.labelEnv}</label>
                <textarea
                  id="mcp-env"
                  rows={3}
                  value={envText}
                  onChange={(e) => setEnvText(e.target.value)}
                  placeholder={COPY.placeholderEnv}
                  disabled={saving}
                  className={TEXTAREA_CLASS}
                />
                <span className={HINT_CLASS}>{COPY.hintEnv}</span>
                {envErrors.map((err) => (
                  <span key={err} role="alert" className="text-[11.5px] text-red">{err}</span>
                ))}
              </div>

              {secretRefs.length > 0 ? <McpSecretsSection keys={secretRefs} disabled={saving} /> : null}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-xs">
                <label htmlFor="mcp-url" className={LABEL_CLASS}>{COPY.labelUrl}</label>
                <input
                  id="mcp-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={COPY.placeholderUrl}
                  disabled={saving}
                  className={MONO_INPUT_CLASS}
                  autoComplete="off"
                />
                <span className={HINT_CLASS}>{COPY.hintUrl(transport)}</span>
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="mcp-headers" className={LABEL_CLASS}>{COPY.labelHeaders}</label>
                <textarea
                  id="mcp-headers"
                  rows={3}
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  placeholder={COPY.placeholderHeaders}
                  disabled={saving}
                  className={TEXTAREA_CLASS}
                />
                <span className={HINT_CLASS}>{COPY.hintHeaders}</span>
                {headerErrors.map((err) => (
                  <span key={err} role="alert" className="text-[11.5px] text-red">{err}</span>
                ))}
              </div>
            </>
          )}

          <label className="flex items-center gap-sm text-[13px] text-fg">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={saving} />
            {COPY.toggleEnabled}
          </label>

          <p className="rounded-sm border border-border bg-surface-2 p-sm text-[11.5px] text-muted">{COPY.warnCodex}</p>

          {errorMessage !== null ? (
            <p role="alert" className="text-[12.5px] text-red">{errorMessage}</p>
          ) : null}
        </div>

        <div className="mt-lg flex items-center justify-end gap-sm">
          <ButtonSecondary disabled={saving} onClick={onCancel}>{COPY.ctaCancel}</ButtonSecondary>
          <ButtonPrimary loading={saving} loadingLabel={COPY.ctaLoading} disabled={!canSubmit} onClick={handleSubmit}>
            {isEdit ? COPY.ctaSave : COPY.ctaCreate}
          </ButtonPrimary>
        </div>
      </div>
    </div>
  )
}

// ── Segredos do cofre ────────────────────────────────────────────────────────

function McpSecretsSection({ keys, disabled }: Readonly<{ keys: string[]; disabled: boolean }>): ReactElement {
  const [definedKeys, setDefinedKeys] = useState<Set<string>>(new Set())
  const [values, setValues] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const res = await mcpsService.listSecretKeys()
    if (!res.error) setDefinedKeys(new Set(res.keys))
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSave = useCallback(async (key: string): Promise<void> => {
    const value = values[key] ?? ''
    if (value === '') return
    setBusyKey(key)
    setError(null)
    try {
      const res = await mcpsService.saveSecret(key, value)
      if (res.error) {
        setError(COPY.secretsError)
        return
      }
      setValues((prev) => ({ ...prev, [key]: '' }))
      await load()
    } catch {
      setError(COPY.secretsError)
    } finally {
      setBusyKey(null)
    }
  }, [values, load])

  const handleClear = useCallback(async (key: string): Promise<void> => {
    setBusyKey(key)
    setError(null)
    try {
      await mcpsService.deleteSecret(key)
      await load()
    } catch {
      setError(COPY.secretsError)
    } finally {
      setBusyKey(null)
    }
  }, [load])

  return (
    <div className="flex flex-col gap-sm rounded-sm border border-border bg-surface-2/40 p-md">
      <div className="flex items-center gap-sm">
        <h3 className="text-[13px] font-semibold text-fg">{COPY.secretsTitle}</h3>
      </div>
      <p className={HINT_CLASS}>{COPY.secretsNote}</p>

      {keys.map((key) => {
        const defined = definedKeys.has(key)
        return (
          <div key={key} className="flex items-center gap-sm">
            <span className="font-mono text-[12px] text-fg">{key}</span>
            <span
              className={`rounded-full border px-sm text-[11px] ${defined ? 'border-green/60 text-green' : 'border-border text-muted'}`}
            >
              {defined ? COPY.secretsBadgeDefined : COPY.secretsBadgeEmpty}
            </span>
            <input
              type="password"
              value={values[key] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={defined ? COPY.secretsPlaceholderReplace : COPY.secretsPlaceholderEmpty}
              disabled={disabled || busyKey === key}
              className={`${INPUT_CLASS} flex-1`}
            />
            <button
              type="button"
              onClick={() => { void handleSave(key) }}
              disabled={disabled || busyKey === key || (values[key] ?? '') === ''}
              className="text-[12px] text-accent hover:underline disabled:opacity-50"
            >
              {COPY.secretsCtaSave}
            </button>
            {defined ? (
              <button
                type="button"
                onClick={() => { void handleClear(key) }}
                disabled={disabled || busyKey === key}
                className="text-[12px] text-muted hover:text-red disabled:opacity-50"
              >
                {COPY.secretsCtaClear}
              </button>
            ) : null}
          </div>
        )
      })}

      {error !== null ? <p role="alert" className="text-[11.5px] text-red">{error}</p> : null}
    </div>
  )
}
