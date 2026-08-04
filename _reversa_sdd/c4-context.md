# C4 — Contexto (Nível 1)

> Gerado pelo Architect (Reversa) em 2026-07-28  
> Confiança: 🟢 CONFIRMADO (inventário + superfície)

## Diagrama

```mermaid
C4Context
  title sistema legado — Contexto do sistema

  Person(owner, "Dono / Desenvolvedor", "Único usuário local da IDE desktop")

  System(sistema_legado, "sistema legado", "IDE Electron local-first: chat com agentes, git, pipeline/build, MCP, memória e codegraph")

  System_Ext(claude, "Claude / Anthropic", "Agent SDK / CLI")
  System_Ext(codex, "Codex CLI", "OpenAI Codex exec + MCP TOML")
  System_Ext(glm, "GLM", "Provider via SDK/CLI")
  System_Ext(minimax, "MiniMax", "Provider via SDK/CLI")
  System_Ext(grok, "Grok", "ACP / runtime")
  System_Ext(kimi, "Kimi", "ACP / runtime")
  System_Ext(github, "GitHub", "git remote, PR, OAuth VCS")
  System_Ext(slack, "Slack API", "MCP first-party")
  System_Ext(linear, "Linear GraphQL", "MCP first-party")
  System_Ext(n8n, "n8n REST", "MCP first-party")
  System_Ext(cartesia, "Cartesia TTS", "MCP first-party")
  System_Ext(elevenlabs, "ElevenLabs TTS", "MCP first-party")
  System_Ext(mcp3p, "MCP 3rd-party", "Servers stdio/http/sse do catálogo do usuário")

  Rel(owner, sistema_legado, "Usa UI; unlock vault; aprova tools; revisa diffs")
  Rel(sistema_legado, claude, "Dispatch / tools / streaming")
  Rel(sistema_legado, codex, "codex exec + bridge MCP")
  Rel(sistema_legado, glm, "Dispatch")
  Rel(sistema_legado, minimax, "Dispatch")
  Rel(sistema_legado, grok, "ACP")
  Rel(sistema_legado, kimi, "ACP")
  Rel(sistema_legado, github, "push / PR / OAuth")
  Rel(sistema_legado, slack, "MCP tools")
  Rel(sistema_legado, linear, "MCP tools")
  Rel(sistema_legado, n8n, "MCP tools")
  Rel(sistema_legado, cartesia, "TTS → .sistema-legado/audio")
  Rel(sistema_legado, elevenlabs, "TTS → .sistema-legado/audio")
  Rel(sistema_legado, mcp3p, "Spawn com secrets do vault")
```

## Personas

| Persona | Relação | Confiança |
|---------|---------|-----------|
| Dono local | Único operador; unlock do cofre; AccessLevel do agente; aprovação de tools | 🟢 |

## Sistemas externos

| Sistema | Protocolo | Direção | Confiança |
|---------|-----------|---------|-----------|
| Providers (claude…kimi) | SDK / CLI / ACP + stdio MCP | sistema legado → | 🟢 |
| GitHub / VCS | git + HTTP API | sistema legado → | 🟢 |
| Slack / Linear / n8n / TTS | MCP stdio + APIs HTTP/GraphQL | sistema legado → (via MCP) | 🟢 |
| MCP 3rd-party | stdio / http / sse | sistema legado spawna | 🟢 |

## Notas

- Não há backend multi-tenant na nuvem: tudo roda no host do usuário (Electron + server loopback).
- Segredos nunca vão em argv; vault → env no spawn (secret-wrapper para MCPs).
