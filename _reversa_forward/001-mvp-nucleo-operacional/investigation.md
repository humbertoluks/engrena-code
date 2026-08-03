# Investigation: 001-mvp-nucleo-operacional

## Fontes
- `_reversa_sdd/prd.md`, `ideation.md`, `personas.md`
- `_reversa_sdd/sdd/*.md` (12 componentes)
- PRD fonte externo EngrenaCode (`engrena-code/docs/PRD.md`)

## Alternativas avaliadas
| Alternativa | Por que não |
|-------------|-------------|
| SaaS colaborativo | Fora do local-first / single-user |
| Só wrapper de terminal | Não resolve diff gate + dashboard |
| API keys no MVP | Adiado a F10 (1.0) |

## Padrões
- Vault local + sessão
- Lease por projeto (`thread_busy`)
- Diff review como gate
- Catálogo skills on-demand / rules inject / subagent delegate

## Ambiente de execução
O workspace atual já possui implementação do sistema legado. Coding expresso deve criar apenas arquivos novos; qualquer overlap com `packages/**` existentes é bloqueio non-destructive.

---
Gerado por reversa-plan em 2026-07-31T10:55:00Z
