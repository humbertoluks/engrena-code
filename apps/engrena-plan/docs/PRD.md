# EngrenaPlan — PRD mínimo (stub)

> Stub S4. Spec completa e ondas de produto ficam para sprints posteriores.
> Família: EngrenaPlan planeja; EngrenaCode entrega.

## 1. Visão

Ferramenta desktop local-first para conduzir o ciclo de planejamento de produto de software até um plano acionável que o EngrenaCode possa executar.

## 2. Pipeline de produto (MVP conceitual)

| Etapa | Nome | Objetivo |
|-------|------|----------|
| 1 | **Discovery** | Explorar problema, stakeholders, restrições e hipóteses |
| 2 | **PRD** | Consolidar requisitos de produto e critérios de aceitação |
| 3 | **Spec** | Especificação técnica acionável (contratos, dados, superfícies) |
| 4 | **Plano** | Fatiar entrega em sprints/tarefas alinhadas ao Code |

## 3. Fora de escopo neste stub

- Editor rico de PRD/Spec
- Boards de discovery
- Integração bidirecional com EngrenaCode além do compartilhamento de marca/packages
- Publicação em npm ou cloud sync

## 4. Scaffold entregue (S4)

- App Electron `apps/engrena-plan` com unlock em `127.0.0.1:5184`
- Consumo de `@engrena/ui`, `@engrena/vault`, `@engrena/http-core`, `@engrena/db-core`
- Shell autenticado vazio + BrandMark EngrenaPlan
- SQLite `engrenaplan.db` com migration mínima `001_meta`

## 5. Critérios de aceitação (scaffold)

1. `pnpm --filter engrena-plan test` e `tsc -b` passam
2. Unlock UI monta e aponta para a porta 5184
3. Isolamento de userData / IPC / session header vs Code
