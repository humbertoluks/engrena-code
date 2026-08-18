# Spec de UI: avisos de runtime e permissão

**Feature:** F30-avisos-de-runtime-e-permissao  
**Destino:** EngrenaCode  
**Componentes:** tarja de `PrincipalScreen`, `PermissionPrompt`, row Claude em `ConfiguracaoScreen`  
**Última atualização:** 2026-08-18

Complementa `docs/F03-workspace/ui.md` (card de permissão) e `docs/F02-configuracao-mvp/ui.md` (card CLIs). Não redesenha o workspace.

## Escopo

**Inclui:** tirar o aviso de versão do Claude CLI da tarja âmbar do chat; mostrar a versão como caption na row Claude de `#configuracao`; countdown no card de permissão; copy curta na tarja quando o card expira (e nos outros casos de negação nativa).

**Exclui:** tela “Sobre” nova; mudar `PERMISSION_TIMEOUT_MS` (continua 2 min); classificador tipo Auto-review / modo `auto` do Claude Code; sandbox de Bash; overlay no lugar do card inline.

## Anatomia (deltas)

### A) Tarja âmbar do workspace (`PrincipalScreen`)

Ordem inalterada: abaixo do header da thread, acima do Histórico/Diff/Grafo.

1. Renderiza só notices `kind: 'mcp'` e `kind: 'native_denial'`.
2. **Nunca** renderiza `kind: 'cli_version'`. Esse kind some do union do renderer se ninguém mais consumir.
3. Cada linha: `text-[12.5px] text-amber`. CTA “Dispensar avisos” inalterado (`COPY.mcpNoticeDismiss` de F03).
4. Teto `MAX_WORKSPACE_NOTICES = 20` inalterado.

Empty: a tarja não monta (`mcpNotices.length === 0`).

### B) Card `PermissionPrompt` (timeline)

Anatomia F03, com **um** slot novo no header:

```
[ O agente precisa de permissão          01:42 ]
[ Permitir a ferramenta Bash?                 ]
[ Parâmetros (details)                        ]
[ hint                                        ]
[ Permitir | Permitir todos | Sempre neste projeto | Negar ]
```

1. Countdown à direita do header, alinhado ao `+N na fila` (fila ganha prioridade visual: se `queuedCount > 0`, fila à direita e countdown imediatamente à esquerda dela).
2. Sem barra de progresso, sem pulse, sem “expira em”. Só o relógio.
3. Aos ≤ 15 s o relógio passa a `text-amber` (token, não hex).
4. Chips continuam concedendo na hora (contrato F03). Clique **não** mexe no rascunho do composer.

### C) Row Claude em `#configuracao` (card CLIs de assinatura)

Anatomia F02 da row, com caption extra **só no Claude**:

```
Claude    ● logado (assinatura)     instalado
          C:\...\claude.exe
          2.1.234
          Ainda não conferida nesta versão.   ← só fora da faixa / ilegível
```

1. Versão em `font-mono text-[11.5px] text-muted`.
2. Caption `cli.version.unverified` / `unparseable` na linha seguinte, mesmo token muted. **Não** usa `text-amber` (não é falha de conexão).
3. Codex e Kimi não ganham linha de versão nesta feature.
4. Versão aparece quando o probe de “Testar conexões” (ou o cache de `readClaudeCliVersion` já quente) devolveu stdout. `GET /api/config/status` continua PATH-only e **não** spawna `claude --version`.

Light/dark: tokens `muted` / `amber` / `fg` / `surface`. Sem hex solto.

## Estados

| Superfície | Estado | Visual |
|------------|--------|--------|
| Tarja | sem notices | ausente |
| Tarja | MCP e/ou native_denial | âmbar + dispensar |
| Tarja | só versão CLI fora da faixa | **ausente** (versão não entra aqui) |
| Card | gate aberto, > 15 s | relógio muted |
| Card | ≤ 15 s | relógio amber |
| Card | resolvido / expirado | some com o gate (já F03) |
| Config Claude | instalado + versão in-range | só `{version}` |
| Config Claude | above-max / below-min | `{version}` + `cli.version.unverified` |
| Config Claude | unparseable | `cli.version.unparseable` |
| Config Claude | não instalado | row F02, sem caption de versão |

## Critérios de aceite visual

1. Primeiro turno Claude com CLI `2.1.234` **não** abre tarja âmbar por versão.
2. `#configuracao` → Testar conexões → row Claude mostra `2.1.234` em mono muted.
3. Fora da faixa: segunda linha “Ainda não conferida nesta versão.” sem alarme amber.
4. Card de Bash aberto mostra relógio `mm:ss` no header; nos últimos 15 s o relógio fica amber.
5. Tarja pós-expiry: duas frases curtas (`denial.expiry.*`), sem “negou por segurança” e sem faixa de versão.
6. Light e dark sem hex solto; `prefers-reduced-motion` não exige animação nova (o relógio é texto).
