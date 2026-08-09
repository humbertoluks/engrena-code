# Exemplos — review-architecture

## Relatório completo (veredito com ressalvas)

```
Review Arquitetura — git diff main...HEAD (F24)
Veredito: ressalvas

🔴 Bloqueia merge
- (nenhum)

🟡 Ajustar antes de fechar a feature
- `src/services/git/git-client.ts:115` — `injectTokenIntoHttpsUrl` sem consumidor de produção após F24 (`gitPush` usa só `injectTokenIntoHttpsUrlByKind`). Correção: tornar local, ou fazer `ByKind('github')` delegar nela.

🟢 Opcional
- `src/main/index.ts:115` — PTY exposto por IPC nomeado: capacidade nativa, aceito. Domínio segue no loopback.

Checklist:
✓ 1. Isolamento do renderer — `rg "from '(node:|fs|electron)'" src/renderer` vazio; `nodeIntegration: false` + `contextIsolation: true` em `src/main/index.ts:20-22`
✓ 2. Preload — grupos `vault`/`dialog`/`shell`/`terminal` pareados com `engrenacode:*`; `write`/`resize` via `ipcMain.on` (streaming, precedente aceito)
✓ 3. Domínio via HTTP — único `fetch(` em screens é o unlock (`LoginScreen.tsx:148`)
✓ 4. Direção das camadas — `rg "renderer/" src/services src/main` sem import de produção
✓ 5. Nomes de domínio — vocabulário Vcs/Provider respeitado
✗ 6. Abstração sem uso concreto — export órfão acima

Não verificado:
- Ciclos de import no grafo completo (sem madge/knip; amostragem cruzada)
```

## Achados 🔴 típicos deste repo

```
- `src/renderer/screens/FooScreen.tsx:88` — `fetch('/api/foo')` direto na tela. Correção: mover para `services/foo-service.ts` + `api-client.ts`.
- `src/main/index.ts:150` — `ipcMain.handle('engrenacode:foo:list')` lendo SQLite. Correção: virar rota `/api/foo` num handler HTTP.
- `src/services/http/foo-handler.ts:12` — handler devolve `true` para `/api/` genérico. Correção: `return false` fora do próprio domínio.
```
