---
title: Lazy-load route screens that are not needed on first paint
impact: HIGH
impactDescription: static imports of every screen put the whole app in the entry chunk
tags: bundle, lazy, code-splitting, routes
---

## Lazy-load route screens that are not needed on first paint

Telas autenticadas (workspace, settings, lists) não entram no chunk inicial. Use `React.lazy` + `Suspense` e um mapa hash/rota → componente. Mantenha eager só o que a primeira pintura precisa (unlock/login e chrome mínimo).

**Incorrect (todas as rotas no grafo estático):**

```tsx
import { WorkspaceScreen } from './screens/WorkspaceScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { DashboardScreen } from './screens/DashboardScreen'

function App({ hash }: { hash: string }) {
  if (hash === '#workspace') return <WorkspaceScreen />
  if (hash === '#settings') return <SettingsScreen />
  return <DashboardScreen />
}
```

**Correct (lazy por rota; login permanece eager):**

```tsx
import { lazy, Suspense } from 'react'
import { LoginScreen } from './screens/LoginScreen'

const DashboardScreen = lazy(() =>
  import('./screens/DashboardScreen').then((m) => ({ default: m.DashboardScreen })),
)
const WorkspaceScreen = lazy(() =>
  import('./screens/WorkspaceScreen').then((m) => ({ default: m.WorkspaceScreen })),
)

const SCREEN_BY_HASH: Record<string, ReturnType<typeof lazy>> = {
  '#workspace': WorkspaceScreen,
}

function HashScreen({ hash }: { hash: string }) {
  const Screen = SCREEN_BY_HASH[hash] ?? DashboardScreen
  return <Screen />
}

function AuthenticatedApp({ hash }: { hash: string }) {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <HashScreen hash={hash} />
    </Suspense>
  )
}
```

Painéis pesados dentro de uma tela (grafo, terminal, editor) também nascem `lazy` se não montam no primeiro render dessa tela.
