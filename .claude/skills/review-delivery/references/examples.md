# Exemplos — review-delivery

## Relatório completo (bloqueado por evidência de smoke)

```
Review Entrega — base completa `src/`
Veredito: bloqueado

🔴 Bloqueia merge
- `docs/F26-terminal-pty-dock/` — UI marcada Feito sem `smoke-results.md`. Correção: smoke via `playwright-cli` + Electron real e gravar a evidência.
- `src/services/process-error.test.ts` — sanitizer estendido sem caso que reproduza o vazamento. Correção: `it(...)` que falha se o token sobreviver.

🟡 Ajustar antes de fechar a feature
- `src/services/codegraph/query.ts` — sem `*.test.ts` irmão (cobertura só indireta via dispatch).

🟢 Opcional
- Working tree limpa — fatiamento não se aplica a esta passagem.

Cobertura por arquivo de produção:
| Arquivo | Teste esperado | Situação |
|---|---|---|
| `src/services/http/voice-handler.ts` | `voice-handler.test.ts` | ✓ 2xx/400/401/423 |
| `src/services/codegraph/query.ts` | `query.test.ts` | ✗ ausente |
| `src/renderer/screens/PrincipalScreen.tsx` | smoke F26 | ✗ sem `smoke-results.md` |

Smoke necessário: sim — dock de PTY e toggle de memória dependem de DOM

Fatiamento sugerido:
1. `test(codegraph): sibling coverage for ensure/query` — `ensure.test.ts`, `query.test.ts`
2. `docs(F26): record smoke evidence` — `docs/F26-*/smoke-results.md`

Checklist:
✓ 1. Regra fora da UI — todo `*.logic.ts` com `*.logic.test.ts` irmão
✗ 2. Cobertura por camada — gaps em `codegraph/`, registries do runner
✗ 3. Smoke E2E — features com UI Feito sem artefato
— 4. Gates de build — `tsc -b`/`vite build`/`biome` não executados neste pedido
— 5. Diff fatiável — working tree limpa
✗ 6. Fechamento — `[x]` no PRD sem evidência de smoke

Não verificado:
- `tsc -b`, `vite build`, `biome lint` (fora do pedido)
```

## Como reportar teste instável

```
🟡 `src/services/runner/delegate.test.ts:496` — timeout de 5s sob carga (falha intermitente; conjunto de falhas muda entre execuções). Correção: `testTimeout` explícito no caso ou fake timers. Registre como flaky, não como regressão do diff.
```
