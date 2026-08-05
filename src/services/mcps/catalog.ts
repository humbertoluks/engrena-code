export type McpTransport = 'stdio' | 'http' | 'sse'
export type McpAuthMode = 'key' | 'oauth'

export interface McpPreset {
  id: string
  name: string
  description: string
  category: string
  transport: McpTransport
  authMode: McpAuthMode
  /** stdio only. */
  command?: string
  args?: string[]
  /** Env vars the install writes as `vault:<key>` refs (stdio, key-mode). */
  secretKeys?: string[]
  /** http/sse only — key-mode presets point at a fixed endpoint. */
  url?: string
  /** OAuth remote endpoint (http/sse), install starts with `authMode: 'oauth'`. */
  remoteUrl?: string
  experimental?: boolean
  /** Preset id of the sibling this one converts to via "Converter para OAuth". */
  oauthSiblingId?: string
  notes?: string
}

/** Catálogo estático first-party — spec §2/§5.3. Instalar cria a definição global; segredos/OAuth vêm depois. */
export const MCP_CATALOG: McpPreset[] = [
  {
    id: 'github',
    name: 'github',
    description: 'Repositórios, issues, PRs e code search do GitHub.',
    category: 'dev',
    transport: 'stdio',
    authMode: 'key',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    secretKeys: ['github_token'],
  },
  {
    id: 'filesystem',
    name: 'filesystem',
    description: 'Leitura/escrita de arquivos num diretório permitido.',
    category: 'dev',
    transport: 'stdio',
    authMode: 'key',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
  },
  {
    id: 'postgres',
    name: 'postgres',
    description: 'Consultas read-only a um banco Postgres.',
    category: 'dados',
    transport: 'stdio',
    authMode: 'key',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    secretKeys: ['postgres_connection_string'],
  },
  {
    id: 'memory',
    name: 'memory',
    description: 'Grafo de conhecimento em memória persistente entre turnos.',
    category: 'dados',
    transport: 'stdio',
    authMode: 'key',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  {
    id: 'brave-search',
    name: 'brave-search',
    description: 'Busca web via API da Brave.',
    category: 'busca',
    transport: 'stdio',
    authMode: 'key',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    secretKeys: ['brave_api_key'],
  },
  {
    id: 'slack',
    name: 'slack',
    description: 'Ler e postar em canais do Slack.',
    category: 'integrações',
    transport: 'stdio',
    authMode: 'key',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    secretKeys: ['slack_bot_token', 'slack_team_id'],
  },
  {
    id: 'stripe',
    name: 'stripe',
    description: 'Consultar clientes, cobranças e assinaturas do Stripe.',
    category: 'integrações',
    transport: 'stdio',
    authMode: 'key',
    command: 'npx',
    args: ['-y', '@stripe/mcp'],
    secretKeys: ['stripe_secret_key'],
  },
  {
    id: 'google-drive',
    name: 'google-drive',
    description: 'Buscar e ler arquivos do Google Drive.',
    category: 'integrações',
    transport: 'stdio',
    authMode: 'key',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-gdrive'],
    secretKeys: ['gdrive_credentials_json'],
  },
  {
    id: 'puppeteer',
    name: 'puppeteer',
    description: 'Automação de browser headless (navegar, screenshot, clicar).',
    category: 'dev',
    transport: 'stdio',
    authMode: 'key',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    experimental: true,
  },
  {
    id: 'sqlite',
    name: 'sqlite',
    description: 'Consultas a um arquivo de banco SQLite local.',
    category: 'dados',
    transport: 'stdio',
    authMode: 'key',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite'],
  },
  {
    id: 'linear-key',
    name: 'linear',
    description: 'Issues e projetos do Linear via API key.',
    category: 'integrações',
    transport: 'http',
    authMode: 'key',
    url: 'https://mcp.linear.app/mcp',
    secretKeys: ['linear_api_key'],
    oauthSiblingId: 'linear-oauth',
  },
  {
    id: 'linear-oauth',
    name: 'linear',
    description: 'Issues e projetos do Linear via OAuth.',
    category: 'integrações',
    transport: 'sse',
    authMode: 'oauth',
    remoteUrl: 'https://mcp.linear.app/sse',
  },
  {
    id: 'notion',
    name: 'notion',
    description: 'Páginas e bases do Notion via OAuth.',
    category: 'integrações',
    transport: 'http',
    authMode: 'oauth',
    remoteUrl: 'https://mcp.notion.com/mcp',
  },
  {
    id: 'sentry',
    name: 'sentry',
    description: 'Issues e eventos de erro do Sentry via OAuth.',
    category: 'dev',
    transport: 'http',
    authMode: 'oauth',
    remoteUrl: 'https://mcp.sentry.dev/mcp',
    experimental: true,
  },
]

export function listMcpPresets(): McpPreset[] {
  return MCP_CATALOG
}

export function getMcpPreset(presetId: string): McpPreset | undefined {
  return MCP_CATALOG.find((p) => p.id === presetId)
}
