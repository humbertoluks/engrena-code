# EngrenaCode — Quick Start

Setup rápido para rodar o app localmente depois de clonar o repositório. Para detalhes de build/release, ver [`docs/RUNBOOK-BUILD.md`](./RUNBOOK-BUILD.md).

## Pré-requisitos

- **Node.js** ≥ 18 (recomendado 20+)
- **pnpm** ≥ 8 (gerenciador de pacotes)
- **Git** ≥ 2.40

### Verificar instalação

```bash
node --version      # v18+ ou v20+
pnpm --version      # 8+
git --version       # 2.40+
```

---

## 1. Clonar e Instalar

```bash
git clone https://github.com/seu-org/engrena-code.git
cd engrena-code
pnpm install
```

Isso instala todas as dependências do monorepo (apps + packages).

---

## 2. Setup do App

```bash
cd apps/engrena-code
cp .env.example .env.local
```

Editar `.env.local` se necessário. Porta padrão: `5173` (Vite dev server).

---

## 3. Rodar em Dev

```bash
# Na raiz do monorepo, ou...
pnpm --filter engrena-code dev

# ...ou dentro de apps/engrena-code/
pnpm dev
```

Vite sobe em `http://localhost:5173` e Electron abre janela. Backend HTTP/WS roda em `http://127.0.0.1:5174` (loopback, não editável).

**Saída esperada:**
- Janela Electron com tela de unlock (workspace + senha do cofre)
- Terminal: `[vite] ready in XXXms` + `Unlock server listening on 127.0.0.1:5174`

---

## 4. Rodar Testes

```bash
pnpm --filter engrena-code test    # Vitest: unit + integração
pnpm --filter engrena-code exec tsc -b  # Type check
```

---

## 5. Build (Produção)

Ver [`docs/RUNBOOK-BUILD.md`](./RUNBOOK-BUILD.md) para instruções de build, empacotamento e artefatos.

---

## Troubleshooting

### "Não posso entrar" / Cofre corrompido

Limpar dados isolados (não toca dados do usuário):

```bash
# bash/PowerShell
rm -r "$TEMP/engrena-*" 
# ou Windows: del %TEMP%\engrena-*
```

Depois, rodar `pnpm dev` de novo.

### Porta 5173 ocupada

Trocar em `.env.local`: `VITE_DEV_SERVER_URL=http://localhost:5174` (escolha primeira livre).

**Nunca** use `5174` (reservada ao servidor de unlock).

### "Cannot find module X"

```bash
pnpm install
rm -rf node_modules .pnpm-lock
pnpm install
```

### Electron não acha a janela

Checkout de novo ou limpar build antigo:

```bash
rm -rf dist-electron dist
pnpm dev
```

### GPU/Network crash em Dev

Se rodar via ferramenta com sandbox (ex.: Bash do Claude Code), pode cair com "Network service crashed". Desabilitar sandbox da ferramenta para `pnpm dev` (não é bug do app).

---

## Próximos passos

- **Estrutura do código:** [`docs/README.md`](./README.md) (índice de todos os docs)
- **Estado real (feito vs pendente):** [`docs/PROGRESS.md`](./PROGRESS.md)
- **Critérios de aceitação e features:** [`docs/PRD.md`](./PRD.md)
- **Glossário de termos:** [`docs/GLOSSARY.md`](./GLOSSARY.md)
