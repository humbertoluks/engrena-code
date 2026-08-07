const BASE_URL = 'http://127.0.0.1:5174'

function sessionToken(): string {
  return localStorage.getItem('sessionToken') ?? ''
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-engrenacode-session': sessionToken(),
  }
}

export interface ProjectFile {
  path: string
}

export interface ApiErrorBody {
  error?: { code: string; message: string }
}

export const projectFilesService = {
  search: async (projectId: string, q: string, limit = 50): Promise<{ files: ProjectFile[] } & ApiErrorBody> => {
    const params = new URLSearchParams()
    if (q.trim() !== '') params.set('q', q.trim())
    params.set('limit', String(limit))
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/files?${params.toString()}`, {
      method: 'GET',
      headers: headers(),
    })
    return res.json() as Promise<{ files: ProjectFile[] } & ApiErrorBody>
  },
}
