# EngrenaCode — Setup e Desenvolvimento

Guia completo para inicializar, configurar e desenvolver EngrenaCode localmente. Inclui correções e validações aplicadas.

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Scaffolding Inicial](#scaffolding-inicial)
3. [Instalação de Dependências](#instalação-de-dependências)
4. [Configuração de Ferramentas](#configuração-de-ferramentas)
5. [Estrutura de Pastas](#estrutura-de-pastas)
6. [Correções Aplicadas](#correções-aplicadas)
7. [Rodando o Projeto](#rodando-o-projeto)
8. [Build para Produção](#build-para-produção)
9. [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

- **Node.js** ≥ 18 (recomendado 20+)
- **pnpm** ≥ 8 (gerenciador de pacotes)
- **Git**

### Instalar pnpm

```bash
npm install -g pnpm
pnpm --version  # Verificar instalação
```

---

## Scaffolding Inicial

### 1. Criar Projeto Vite + React + TypeScript

```bash
npm create vite@latest engrena-code -- --template react-ts
cd engrena-code
```

### 2. Trocar para pnpm

```bash
pnpm install
```

Isso remove node_modules de npm e recria com pnpm (mais eficiente).

---

## Instalação de Dependências

### Dependências Principais (Production)

```bash
pnpm add axios crypto-js electron-is-dev react react-dom zustand
```

**Notas:**
- `axios` — HTTP client para MCPs e APIs externas
- `crypto-js` — Criptografia para vault local
- `electron-is-dev` — Detectar modo dev vs production
- `zustand` — State management leve
- React/ReactDOM — Já instalados via Vite

### Dependências Dev (Electron + Build)

```bash
pnpm add --save-dev electron electron-builder cross-env
pnpm add --save-dev typescript ts-node @types/node @types/react @types/react-dom
pnpm add --save-dev tailwindcss postcss autoprefixer
pnpm add --save-dev @biomejs/biome
pnpm add --save-dev vite-plugin-electron vite-plugin-electron-renderer @electron-toolkit/utils
```

**Notas:**
- `electron` + `electron-builder` — DEVE estar em devDependencies (não dependencies)
- `cross-env` — Compatibilidade multiplataforma para env vars
- `@biomejs/biome` — Linter + formatter (substitui ESLint + Prettier)
- `vite-plugin-electron*` — Integração Vite com Electron

### ❌ NÃO INSTALAR

- `better-sqlite3` — Native module. Usar SQLite JS ou adiar até F02.
- `eslint` — Use Biome
- `prettier` — Use Biome

---

## Configuração de Ferramentas

### 1. Tailwind CSS

```bash
pnpm exec tailwindcss init -p
```

Gera `tailwind.config.js` e `postcss.config.js`.

### 2. vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts'
      },
      {
        entry: 'src/preload/index.ts'
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173
  }
})
```

### 3. biome.json

```json
{
  "extends": ["@biomejs/biome/recommended"],
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "useConst": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "lineWidth": 100,
    "indentStyle": "space",
    "indentSize": 2
  },
  "javascript": {
    "formatter": {
      "semicolons": "always",
      "quoteStyle": "single",
      "trailingCommas": "es5"
    }
  },
  "json": {
    "formatter": {
      "trailingCommas": "none"
    }
  }
}
```

### 4. .env.example

```env
# Claude configuration
CLAUDE_API_KEY=sk-ant-

# Codex configuration
CODEX_PATH=/path/to/codex

# Kimi configuration
KIMI_PATH=/path/to/kimi

# GitHub Personal Access Token
GITHUB_PAT=ghp_

# Development
VITE_DEV_SERVER_URL=http://localhost:5173
```

Copiar para `.env.local` (não versionado).

### 5. package.json — Metadata + Scripts

**Adicionar após "type": "module":**

```json
{
  "name": "engrena-code",
  "description": "IDE Local-First para Orquestração de Agentes de IA",
  "author": "Lukse",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "dist-electron/index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build && electron-builder",
    "preview": "vite preview",
    "lint": "biome lint --write .",
    "format": "biome format --write ."
  },
  "build": {
    "appId": "com.lukse.engrenacode",
    "productName": "EngrenaCode",
    "directories": {
      "output": "dist",
      "buildResources": "assets"
    },
    "files": [
      "dist-electron",
      "dist/**/*"
    ],
    "win": {
      "target": ["nsis", "portable"]
    }
  }
}
```

**Pontos críticos:**
- `"type": "module"` — ESM na aplicação
- `"main": "dist-electron/index.js"` — Electron Builder espera isso
- `"description"` e `"author"` — Obrigatório para Electron Builder
- Scripts: `dev` sem orquestração extra (Vite + Electron rodam juntos via plugin)

---

## Estrutura de Pastas

```bash
mkdir -p src/{main,preload,renderer,db,services,features,hooks}
mkdir -p src/db/{schemas,migrations}
mkdir -p src/services/{vault,providers,github,mcps}
mkdir -p src/features/{workspace,dashboard,skills,rules,subagents,registros,consumo}
```

**Organização:**
- `src/main/` — Electron main process
- `src/preload/` — Preload script (IPC bridge)
- `src/renderer/` — React app (UI)
- `src/db/` — Database schema e migrations
- `src/services/` — Lógica de negócio (vault, providers, APIs)
- `src/features/` — Componentes e lógica por feature (F01–F11)
- `src/hooks/` — Custom React hooks

---

## Correções Aplicadas

### 1. __dirname em ES Modules (Electron Main)

**Problema:** `ReferenceError: __dirname is not defined` quando rodar app.

**Solução:** Em `src/main/index.ts`, adicionar:

```typescript
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
```

### 2. Preload em CommonJS

**Problema:** `SyntaxError: contextBridge is not exported` quando preload tenta `import { contextBridge }`.

**Solução:** `src/preload/index.ts` usa CommonJS (require), não ESM:

```typescript
const { contextBridge, ipcRenderer } = require('electron')

const api = {
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event: any, ...args: unknown[]) => listener(...args))
  },
  send: (channel: string, data?: unknown) => ipcRenderer.send(channel, data)
}

contextBridge.exposeInMainWorld('electronAPI', api)
```

### 3. Electron + Electron-Builder em devDependencies

**Problema:** Electron-builder recusa se `electron` estiver em `dependencies`.

**Solução:** Ambos em `devDependencies`:

```bash
pnpm remove electron electron-builder
pnpm add --save-dev electron electron-builder
```

### 4. package.json — Campos Obrigatórios

**Problema:** Electron-builder falha se faltar `description` ou `author`.

**Solução:** Adicionar ao package.json:

```json
{
  "description": "IDE Local-First para Orquestração de Agentes de IA",
  "author": "Lukse"
}
```

### 5. index.html — Caminho do Entry Point

**Problema:** index.html referencia `/src/main.tsx` mas arquivo está em `/src/renderer/main.tsx`.

**Solução:** Atualizar:

```html
<script type="module" src="/src/renderer/main.tsx"></script>
```

---

## Rodando o Projeto

### Dev Mode

```bash
pnpm dev
```

**O que acontece:**
1. Vite inicia servidor em `http://localhost:5173`
2. Electron abre janela e conecta ao servidor
3. HMR (Hot Module Reload) atualiza a UI ao salvar código

**Saída esperada:**
- Janela Electron com tela "EngrenaCode — IDE Local-First para Agentes de IA — Inicializando componentes..."
- Terminal mostra `[vite] ready in XXXms`

### Build para Desenvolvimento

```bash
pnpm run build
```

Compila TypeScript, Vite e gera instaladores:
- `dist/EngrenaCode Setup 0.0.0.exe` — Instalador NSIS
- `dist/EngrenaCode 0.0.0.exe` — Portable executável

---

## Build para Produção

Mesmo comando que dev:

```bash
pnpm run build
```

**Outputs:**
- `dist-electron/` — Main + preload compilados
- `dist/` — React app + instaladores Windows

**Customizar Build:**
- Editar `package.json` → `"build"` para outras plataformas
- Exemplo macOS:

```json
"build": {
  "mac": {
    "target": ["dmg", "zip"]
  }
}
```

---

## Troubleshooting

### "Cannot find module 'electron'"

Solução: `pnpm install` novamente

```bash
pnpm install
```

### Vite server não conecta

Porta 5173 pode estar em uso:

```bash
# Liberar porta (Windows PowerShell)
Get-Process | Where-Object {$_.Port -eq 5173}
Stop-Process -Id <PID>

# Ou trocar porta em vite.config.ts
server: {
  port: 5174
}
```

### "contextBridge is not exported"

Preload foi recompilado como ESM. Verificar:
1. `src/preload/index.ts` usa `require()`, não `import`
2. Rodar `pnpm run build` novamente

### Electron não acha dist-electron/index.js

`"main"` em package.json pode estar incorreto:

```json
"main": "dist-electron/index.js"
```

Remover `.ts` — Electron espera JS compilado.

### Biome recusa formato

Rodar:

```bash
pnpm lint
pnpm format
```

---

## Próximos Passos

1. **F01 — Vault e Sessão Local** (`docs/F01-vault-e-sessao-local/`)
2. **F02 — Configuração MVP**
3. **F03 — Workspace**

Ver roadmap em `prd-engrenacode.md`.
