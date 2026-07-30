import React, { useState, useCallback, useMemo, useRef } from 'react'

interface LoginState {
  workspace: string
  password: string
  error: string | null
  backoffMs: number
  isLoading: boolean
}

interface VaultUnlockResponse {
  unlocked: boolean
  retryAfterMs?: number
}

export const LoginScreen: React.FC = () => {
  const [state, setState] = useState<LoginState>(() => ({
    workspace: '',
    password: '',
    error: null,
    backoffMs: 0,
    isLoading: false
  }))

  const backoffTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleWorkspaceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev) => ({ ...prev, workspace: e.target.value, error: null }))
    },
    []
  )

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev) => ({ ...prev, password: e.target.value, error: null }))
    },
    []
  )

  const startBackoff = useCallback((ms: number) => {
    if (backoffTimerRef.current) {
      clearInterval(backoffTimerRef.current)
    }

    setState((prev) => ({ ...prev, backoffMs: ms }))

    const startTime = Date.now()
    backoffTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, ms - elapsed)

      setState((prev) => ({ ...prev, backoffMs: remaining }))

      if (remaining <= 0 && backoffTimerRef.current) {
        clearInterval(backoffTimerRef.current)
        backoffTimerRef.current = null
      }
    }, 100)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!state.workspace.trim() || !state.password) {
        setState((prev) => ({
          ...prev,
          error: 'Workspace e senha são obrigatórios.'
        }))
        return
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const response = await fetch('http://127.0.0.1:5174/api/vault/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace: state.workspace.trim(),
            password: state.password
          })
        })

        const data = (await response.json()) as VaultUnlockResponse

        if (response.ok && data.unlocked) {
          // Success - obtained session token via preload IPC
          if (window.electronAPI?.invoke) {
            const token = await window.electronAPI.invoke('engrenacode:vault:get-session')
            if (token) {
              localStorage.setItem('sessionToken', token as string)
              // Navigate to dashboard
              window.location.hash = '#dashboard'
            }
          }
        } else {
          // Failure
          const retryMs = data.retryAfterMs || 0
          if (retryMs > 0) {
            startBackoff(retryMs)
            setState((prev) => ({
              ...prev,
              error: `Muitas tentativas. Tente novamente em ${Math.ceil(retryMs / 1000)}s.`,
              isLoading: false
            }))
          } else {
            setState((prev) => ({
              ...prev,
              error: 'Workspace ou senha inválidos.',
              isLoading: false
            }))
          }
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: 'Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução.',
          isLoading: false
        }))
      }
    },
    [state.workspace, state.password, startBackoff]
  )

  const isButtonDisabled = useMemo(
    () => state.isLoading || state.backoffMs > 0 || !state.workspace.trim() || !state.password,
    [state.isLoading, state.backoffMs, state.workspace, state.password]
  )

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">EngrenaCode</h1>
          <p className="text-slate-400">IDE Local-First para Agentes de IA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="workspace" className="block text-sm font-medium mb-2">
              Workspace
            </label>
            <input
              id="workspace"
              type="text"
              value={state.workspace}
              onChange={handleWorkspaceChange}
              placeholder="~/dev"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              disabled={state.isLoading || state.backoffMs > 0}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={state.password}
              onChange={handlePasswordChange}
              placeholder="••••••••"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              disabled={state.isLoading || state.backoffMs > 0}
            />
          </div>

          {state.error && (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-200 text-sm">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isButtonDisabled}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {state.isLoading
              ? 'Desbloqueando...'
              : state.backoffMs > 0
                ? `Aguarde ${Math.ceil(state.backoffMs / 1000)}s`
                : 'Desbloquear'}
          </button>
        </form>

        <p className="text-slate-500 text-xs text-center mt-8">
          Credenciais armazenadas localmente • Sem transmissão remota
        </p>
      </div>
    </div>
  )
}
