# Regression watch: 001-mvp-nucleo-operacional

> Coding não executou ações de aplicação. Itens abaixo são invariantes do MVP a validar quando o código for gerado em repo greenfield ou via evolução controlada.

## Invariantes a preservar
1. Credenciais nunca em claro no SQLite
2. Unlock com backoff após 5 falhas
3. Tema `engrenacode:theme` com fail-soft `system`
4. Máximo 1 execução longa por projeto (`thread_busy`)
5. Git mutável bloqueado com thread running
6. Dashboard sem mutações de diff/turno/git
7. Precedência de rules: projeto > global > arquivos do repo
8. Codex pai só delega com `full-access`
9. Skills não executam código; content via `load_skill`
10. Escopo MVP sem F08–F11

## Status
Pendente de implementação (0/18 actions `[X]`).

---
Gerado por reversa-coding (parada legítima) em 2026-07-31T11:00:00Z
