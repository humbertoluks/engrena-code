export const API_BASE_URL = 'http://127.0.0.1:5174'

export interface ApiErrorBody {
  error?: { code: string; message: string }
}

function sessionHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-engrenacode-session': localStorage.getItem('sessionToken') ?? '',
  }
}

function redirectToLogin(): void {
  localStorage.removeItem('sessionToken')
  void window.electronAPI?.vault?.lock?.()
}

function errorCode(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('error' in data)) return undefined
  const err = (data as ApiErrorBody).error
  return typeof err?.code === 'string' ? err.code : undefined
}

/** Shared loopback fetch for authenticated renderer services. */
export async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: sessionHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  let data: unknown = undefined
  if (text.trim() !== '') {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      throw new Error(`Resposta inválida do servidor (${res.status}).`)
    }
  }

  const code = errorCode(data)
  if (res.status === 423 || res.status === 401 || code === 'vault_locked' || code === 'unauthorized') {
    redirectToLogin()
  }

  return data as T
}
