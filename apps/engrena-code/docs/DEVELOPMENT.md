# EngrenaCode — Quick Start

Setup rápido para rodar o app localmente depois de clonar o repositório. Para detalhes de build/release, ver [`RUNBOOK-BUILD.md`](./RUNBOOK-BUILD.md).

## Pré-requisitos

Declarados em `package.json` da raiz (`engines`):

- **Node.js** ≥ 18
- **pnpm** ≥ 8
- **Git** no PATH (worktree e fluxo git do app)

### Verificar instalação

```bash
node --version      # v18+
pnpm --version      # 8+
git --version
```

---

## 1. Clonar e Instalar

```bash
git clone https://github.com/humbertoluks/engrena-code.git
cd engrena-code
pnpm install
```

Isso instala todas as dependências do monorepo (apps + packages). Rode `pnpm install` **na raiz**.

---

## 2. Setup do App

```bash
cd apps/engrena-code
cp .env.example .env.local
```

Editar `.env.local` se necessário. Porta padrão do Vite: `5173` (`vite.config.ts` `server.port` + `VITE_DEV_SERVER_URL`).

---

## 3. Isolar dados de sessão (recomendado)

O cofre real do usuário (`app.getPath('userData')`) não deve ser usado em smoke nem em teste manual. Antes de `pnpm dev`, aponte `ENGRENACODE_USER_DATA` para um diretório temporário:

```bash
ENGRENACODE_USER_DATA="$TEMP/engrena-smoke-<slug>" pnpm --filter engrena-code dev
```

```powershell
$env:ENGRENACODE_USER_DATA = "$env:TEMP\engrena-smoke-<slug>"
pnpm --filter engrena-code dev
```

Isso redireciona `vault.enc`, o SQLite (`engrenacode.db`) e os worktrees para o diretório isolado. Não apague o `userData` real.

---

## 4. Rodar em Dev

Na raiz do monorepo:

```bash
pnpm --filter engrena-code dev
```

Ou, dentro de `apps/engrena-code/`:

```bash
pnpm dev
```

Vite sobe em `http://localhost:5173` e o Electron abre a janela. Backend HTTP/WS roda em `http://127.0.0.1:5174` (loopback, porta fixa, não editável).

**Saída esperada:**
- Janela Electron com tela de unlock (workspace + senha do cofre)
- Terminal: `[vite] ready in XXXms` + `Unlock server listening on http://127.0.0.1:5174`

---

## 5. Rodar Testes

```bash
pnpm --filter engrena-code test    # Vitest: unit + integração
pnpm --filter engrena-code exec tsc -b  # Type check (não emite JS)
```

---

## 6. Build (Produção)

Ver [`RUNBOOK-BUILD.md`](./RUNBOOK-BUILD.md) para instruções de build, empacotamento e artefatos. Encerre o Electron do `pnpm dev` antes: o empacotamento falha com EPERM se a janela ainda estiver aberta.

---

## Troubleshooting

### "Não posso entrar" / Cofre de smoke corrompido

Só apague artefatos **isolados** desta sessão, nunca o `userData` real:

```bash
rm -r "$TEMP/engrena-smoke-"*
```

```powershell
Remove-Item -Recurse -Force "$env:TEMP\engrena-smoke-*"
```

Depois suba de novo com `ENGRENACODE_USER_DATA` apontando para uma pasta nova.

### Porta 5173 ocupada

Vite escuta o `server.port` de `apps/engrena-code/vite.config.ts`. O Electron carrega a URL de `VITE_DEV_SERVER_URL` em `.env.local` (fallback `http://localhost:5173`). Os dois têm de ser a **mesma** porta.

Escolha a primeira livre ≥ 5173, **exceto 5174** (unlock/API/WS do Code) e **5184** (unlock do Plan). Exemplo, se 5175 estiver livre:

1. Em `vite.config.ts`: `server: { port: 5175 }`
2. Em `.env.local`: `VITE_DEV_SERVER_URL=http://localhost:5175`

Mudar só o `.env.local` deixa o Vite em 5173 e a janela aponta para uma porta vazia.

### "Cannot find module X"

Na **raiz** do monorepo:

```bash
pnpm install
```

Se ainda falhar, apague `node_modules` da raiz (e os de `apps/*` / `packages/*` se existirem) e rode `pnpm install` de novo. O lockfile é `pnpm-lock.yaml` na raiz; não se chama `.pnpm-lock`.

### Electron não acha a janela

Limpar build antigo **dentro de** `apps/engrena-code/`:

```bash
rm -rf dist-electron dist
pnpm --filter engrena-code dev
```

### GPU/Network crash em Dev

Se rodar via ferramenta com sandbox (ex.: Bash do Claude Code), pode cair com "Network service crashed". Passe `dangerouslyDisableSandbox: true` (ou o equivalente da ferramenta) só para `pnpm dev`. Não é bug do app.

---

## Próximos passos

- **Índice de docs:** [`README.md`](./README.md)
- **Estado real (feito vs pendente):** [`PROGRESS.md`](./PROGRESS.md)
- **Critérios de aceitação e features:** [`PRD.md`](./PRD.md)
- **Glossário de termos:** [`GLOSSARY.md`](./GLOSSARY.md)
