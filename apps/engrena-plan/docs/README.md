# EngrenaPlan

App Electron local-first da família Engrena para **planejar** antes de entregar no EngrenaCode.

## Papel na família

| App | Função |
|-----|--------|
| **EngrenaPlan** | Discovery → PRD → Spec → Plano |
| **EngrenaCode** | Orquestração de agentes e entrega |

## Dev

```bash
# na raiz do monorepo
pnpm --filter engrena-plan dev
pnpm --filter engrena-plan test
```

- Vite: `http://localhost:5175` (não usar 5174 nem 5184)
- Unlock loopback: `http://127.0.0.1:5184`
- userData isolado via `appId` `com.lukse.engrenaplan` / env `ENGRENAPLAN_USER_DATA`
- DB: `engrenaplan.db`

## Escopo atual (S4 scaffold)

Unlock + shell vazio. Domínio Discovery/PRD/Spec/Plano ainda não implementado — ver [PRD.md](./PRD.md).

## Packages consumidos

- `@engrena/ui`
- `@engrena/vault`
- `@engrena/http-core`
- `@engrena/db-core`
