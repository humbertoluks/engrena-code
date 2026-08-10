# Smoke: F04. Dashboard

**Data:** 2026-08-05 (smoke inicial) + 2026-08-07 (residual de tema cross-tela)
**Método:** `pnpm dev` (Electron + Vite reais) + `playwright-cli`, com `ENGRENACODE_USER_DATA` isolado (vault real do usuário intocado) e projeto fixture dentro do próprio repo. Threads/diffs semeados diretamente no SQLite do fixture, sem disparar turno real de agente. Residual de tema: build empacotado (`dist/win-unpacked/EngrenaCode.exe --user-data-dir=<isolado> --remote-debugging-port`) + `playwright-cli`.

**Nota de proveniência:** este arquivo foi escrito em 2026-08-09 formalizando, no local e formato padrão (`docs/F04-*/smoke-results.md`), o smoke real já narrado com detalhe em `docs/PROGRESS.md` (linhas 142–150 na época) — não é uma nova rodada de smoke ao vivo. `R-missing-smoke-evidence`/D07 tratava a ausência do arquivo dedicado, não a ausência de evidência real.

## Confirmado ao vivo

1. **Redirecionamento pós-unlock**: unlock abre `#dashboard` (não o Workspace), com saúde da config (4 dots) e os 4 metric cards.
2. **Inbox priorizada**: os 4 kinds (`setup incompleto` → `erro` → `diff pendente` → `running`) aparecem na ordem certa de precedência.
3. **Navegação por clique**: clique num item `diff pendente` navega para `#principal?project=...&thread=...&tab=diff` e o Workspace abre com a aba **Diff** já selecionada, mostrando o arquivo, `+12/-4` e Aceitar/Rejeitar corretos.
4. **Catálogo → SubAgents**: clique no contador de SubAgents do catálogo navega para `#subagents`.
5. **Grade de projetos e atividade recente**: populadas corretamente a partir do fixture; zero erros/warnings no console.
6. **Light/dark**: conferido contra os tokens de `ui.md` — `ui/dashboard-referencia-light.png` e `ui/dashboard-referencia-dark.png`.
7. **Tema persiste entre telas** (residual fechado 2026-08-07, via build empacotado): trocar tema em `#dashboard` para `light` sobrevive à navegação `#configuracao` → `#principal`; trocar para `dark` em `#principal` sobrevive em `#principal` → `#dashboard` → `#configuracao`; preferência `dark` sobrevive a `page.reload()` (sessão do vault permanece desbloqueada porque o main process não reinicia num reload de janela). `useTheme()` é singleton em nível de módulo (`<ThemeControl />` montado uma única vez em `App.tsx`, fora do switch de rota) — nenhum bug encontrado.

## Não exercitado neste smoke

- Turno real de agente populando a inbox organicamente (dados foram semeados direto no SQLite do fixture, não via dispatch real) — cobertura de dispatch real já existe via F03/F08.

## Screenshots

- `ui/dashboard-referencia-light.png` / `ui/dashboard-referencia-dark.png` (já existentes no repo desde a implementação original)
