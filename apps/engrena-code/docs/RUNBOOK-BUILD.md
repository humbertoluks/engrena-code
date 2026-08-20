# EngrenaCode — Runbook de Build e Release

Instruções para compilar, empacotar e gerar artefatos de release do EngrenaCode.

**Atualizado:** 2026-08-20

---

## Pré-requisitos

Os mesmos de [`DEVELOPMENT.md`](./DEVELOPMENT.md) (Node ≥ 18, pnpm ≥ 8, Git no PATH), mais:

- Windows 10/11 x64 (este runbook só gera `.exe`)
- **Nada** escutando na porta 5174 (servidor de unlock)
- **Electron do `pnpm dev` fechado** — o empacotamento falha com EPERM se a janela ainda estiver aberta

**Verificar:**

```bash
node --version
pnpm --version
git --version
```

```powershell
Get-NetTCPConnection -LocalPort 5174 -State Listen
```

---

## 1. Prepare o ambiente

Na raiz do monorepo:

```bash
pnpm install
cd apps/engrena-code
```

---

## 2. Type-check e Testes

**Antes de empacotar, rodar os gates:**

```bash
# Dentro de apps/engrena-code/
pnpm exec tsc -b          # Type check (noEmit: true — não emite JS)
pnpm test                 # Vitest suite completa; o critério é exit 0
```

Se ambos passarem com exit 0, prosseguir. Se falharem:

- `tsc -b` error → Bug no TypeScript (corrigir código)
- `pnpm test` fail → Teste regrediu (investigar e corrigir)

---

## 3. Build (Vite + Electron-Builder)

O script `pnpm run build` é `tsc -b && vite build && electron-builder`.

**O que faz:**
1. `tsc -b` — Type-check de main, preload, renderer e services (`noEmit`)
2. `vite build` — Compila o renderer em `dist/` **e**, via `vite-plugin-electron`, emite `dist-electron/index.js` (main, ESM) e `dist-electron/preload.cjs` (preload, CommonJS)
3. `electron-builder` — Gera instaladores em `release/`

**Duração esperada:** 2–5 minutos (primeiros builds podem demorar mais).

**Saída esperada** (nomes com a `version` de `apps/engrena-code/package.json`, hoje `0.0.0`):

```
dist-electron/
  ├── index.js          (main process, ESM)
  └── preload.cjs       (preload, CommonJS)

dist/
  ├── index.html
  ├── assets/
  └── ...

release/
  ├── EngrenaCode Setup 0.0.0.exe   (Instalador NSIS)
  ├── EngrenaCode 0.0.0.exe         (Executável portable)
  └── builder-effective-config.yaml  (config efetivo)
```

---

## 4. Artefatos de Release

### Instaladores Windows

| Arquivo | Tipo | Comportamento |
|---------|------|--------------|
| `EngrenaCode Setup <version>.exe` | NSIS installer | Wizard de instalação. Escolha de diretório, atalhos. Desinstalador. |
| `EngrenaCode <version>.exe` | Portable | Executável direto (sem instalação). |

**Localização:** `apps/engrena-code/release/`

### Artefatos de Build

| Pasta | Conteúdo | Uso |
|-------|----------|-----|
| `dist-electron/` | Main + preload compilados pelo Vite | Empacotado no `.asar` |
| `dist/` | React app (renderer) | Empacotado no `.asar` |
| `release/` | Instaladores `.exe` | Distribuição ao usuário |

**Não versionar:** `dist/`, `dist-electron/`, `release/`. Regenerar em cada build.

---

## 5. Customizar Build

A fonte de verdade é a chave `"build"` em `apps/engrena-code/package.json`. Não copie um trecho daqui para o arquivo: o objeto vivo inclui `extraResources` (`assets/icon.png` → `icon.png`), `win.icon` (`assets/icon.ico`), `signAndEditExecutable` e o unpack do `node-pty`. Apagar esses campos no JSON deixa o `.exe` sem ícone ou o PTY mudo.

macOS (`dmg`/`zip`) e Linux (`AppImage`/`deb`) não estão no `package.json` hoje.

---

## 6. Ícone e Branding

- **Fonte:** `assets/icon.svg` (logo em SVG)
- **Windows:** `assets/icon.ico` (multi-size, já commitado; `win.icon` no electron-builder)
- **Janela:** `assets/icon.png` (512×512), copiado para `extraResources` como `icon.png`; o main resolve em `process.resourcesPath` no app empacotado

O `electron-builder` automaticamente:
1. Usa `icon.ico` no executável (`.exe`)
2. Cria atalho com ícone na Desktop/Menu Iniciar
3. Empacota `icon.png` para a janela da aplicação (`setAppUserModelId('com.lukse.engrenacode')`)

**Se o ícone sair preto:** Feche o Setup/app, limpe o cache do Explorer, reconstrua. Ver também a regra de ícone no `CLAUDE.md`.

```powershell
ie4uinit.exe -show
```

---

## 7. Validação pós-Build

### 7.1 Verificar artefatos

```powershell
ls apps/engrena-code/release/
```

Deve conter o Setup NSIS, o portable e `builder-effective-config.yaml`. Os nomes seguem a `version` do `package.json`.

### 7.2 Testar instalador (opcional)

```powershell
& "apps/engrena-code/release/EngrenaCode Setup 0.0.0.exe"

# Ou testar portable direto
& "apps/engrena-code/release/EngrenaCode 0.0.0.exe"
```

Deve abrir a janela de splash → tela de unlock.

### 7.3 Testar o app executável

Depois de instalar (ou portable), abrir e rodar os [Roteiros de Homologação](./RUNBOOK-HOMOLOGACAO.md) (A–E).

---

## 8. Troubleshooting

### EPERM ao renomear `release/win-unpacked`

O Electron do `pnpm dev` (ou um Setup/app aberto) segura o arquivo. Encerre o processo da janela e rode `pnpm run build` de novo. `tsc -b` e `vite build` já podem ter passado; o erro é só o empacotamento.

### "dist-electron não existe"

O `vite-plugin-electron` não emitiu main/preload. Limpe e rode o **build completo** (não só `tsc -b`, que não emite):

```bash
rm -r dist-electron dist
pnpm run build
```

### "Cannot find file assets/icon.ico"

O `electron-builder` espera o multi-size já versionado em `assets/icon.ico`. Se precisar regenerar (ImageMagick 7):

```bash
magick assets/icon.svg -define icon:auto-resize=256,128,96,64,48,32,16 assets/icon.ico
```

Não remova `icon.ico` do git: o builder não gera esse arquivo sozinho a partir do SVG.

### "Instalador sai com erro 0x80004005"

Falha genérica do `electron-builder`. Feche o app, limpe e tente novamente:

```bash
rm -r release dist-electron dist
pnpm run build
```

### "App empacotado não abre"

Verificar se `dist/index.html` existe:

```bash
ls apps/engrena-code/dist/index.html
```

Se não existir, o Vite não compilou o renderer. Rodar `pnpm build` de novo.

### "Arquivo no release pode estar quebrado"

```powershell
Get-FileHash "apps/engrena-code/release/EngrenaCode 0.0.0.exe"
```

Comparar com hash esperado (se houver).

---

## 9. CI/CD e Automação

Não há workflow de build Windows neste repo hoje. Se for criar um, depois dos testes verdes:

```yaml
- name: Build
  run: |
    cd apps/engrena-code
    pnpm run build

- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    name: engrena-code-release
    path: apps/engrena-code/release/
```

---

## 10. Checklist de Release

- [ ] Electron / `pnpm dev` / Setup fechados
- [ ] `pnpm test` — exit 0
- [ ] `pnpm exec tsc -b` — Zero erros
- [ ] `pnpm run build` — Exit 0
- [ ] `release/EngrenaCode Setup <version>.exe` existe
- [ ] `release/EngrenaCode <version>.exe` existe
- [ ] Testar instalador (Roteiro A de [`RUNBOOK-HOMOLOGACAO.md`](./RUNBOOK-HOMOLOGACAO.md))
- [ ] Testar app executável (Roteiros A–E completos)
- [ ] Sem erros no console da janela do Electron
- [ ] Sem regressões visuais (light/dark, layout)
- [ ] Versão no `package.json` atualizada (se novo semver)

---

## Leia também

- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — Quick Start (dev mode)
- [`RUNBOOK-HOMOLOGACAO.md`](./RUNBOOK-HOMOLOGACAO.md) — Validação manual (pós-build)
- [`PROGRESS.md`](./PROGRESS.md) — Estado das features (para decidir versão)
