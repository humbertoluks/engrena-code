# vault-gate, Tarefas de Implementação

> Sequência para reimplementar o gate de cofre no renderer.

## Pré-requisitos

- [ ] Rota HTTP unlock no server com rate limit/backoff
- [ ] IPC shell: `getSessionToken`, `onVaultLocked`
- [ ] `useHashRoute` e `routes.ts` definidos

## Tarefas

- [ ] T-01, Implementar LoginScreen (form, estados, backoff tick)
  - Origem: `packages/renderer/src/screens/LoginScreen.tsx`
  - Critério de pronto: submit chama api unlock; erros mapeados por kind
  - Confiança: 🟢

- [ ] T-02, Mapear erros API → ErrorKind + Retry-After
  - Origem: `packages/renderer/src/api/errors.ts`, LoginScreen catch
  - Critério de pronto: 429 desabilita botão pelo tempo correto
  - Confiança: 🟢

- [ ] T-03, Guarda hash: redirect protegido + intendedRef
  - Origem: `packages/renderer/src/router/useHashRoute.ts`
  - Critério de pronto: locked + `#principal` → `#login` + intended guardado
  - Confiança: 🟢

- [ ] T-04, App handleUnlocked: IPC token antes de unlocked=true
  - Origem: `packages/renderer/src/App.tsx` (`handleUnlocked`)
  - Critério de pronto: setSessionToken antes do AppShell montar
  - Confiança: 🟢

- [ ] T-05, Handler onVaultLocked: limpar token e estado
  - Origem: `packages/renderer/src/App.tsx` (useEffect vault lock)
  - Critério de pronto: lock força LoginScreen; API sem header
  - Confiança: 🟢

- [ ] T-06, resumeAfterUnlock navega intended ou default
  - Origem: `packages/renderer/src/router/useHashRoute.ts`
  - Critério de pronto: pós-unlock abre rota memorizada
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Unlock feliz → token setado → hash resume
- [ ] TT-02, Senha inválida → mensagem genérica
- [ ] TT-03, 429 → backoff UI até expirar
- [ ] TT-04, Vault lock mid-session → gate imediato

## Ordem Sugerida

1. T-01, T-02 (tela + erros)
2. T-03, T-06 (routing)
3. T-04, T-05 (integração App + IPC)

## Lacunas Pendentes (🔴)

- Cenário vault corrupto end-to-end com backup/restore
