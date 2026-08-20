# EngrenaCode — Runbook de Build e Release

Instruções para compilar, empacotar e gerar artefatos de release do EngrenaCode.

**Atualizado:** 2026-08-19

---

## Pré-requisitos

- Node.js ≥ 18 (recomendado 20+)
- pnpm ≥ 8
- Git ≥ 2.40
- Windows 10/11 x64 (para `.exe`)

**Verificar:**

```bash
node --version
pnpm --version
git --version
```

---

## 1. Prepare o ambiente

Na raiz do monorepo:

```bash
pnpm install
cd apps/engrena-code
```

Certifique-se de que **nada** escuta na porta 5174 (servidor de unlock):

```powershell
# PowerShell
Get-NetTCPConnection -LocalPort 5174 -State Listen
```

---

## 2. Type-check e Testes

**Antes de compilar, rodar os gates:**

```bash
# Dentro de apps/engrena-code/
pnpm exec tsc -b          # Type check (sem emitir)
pnpm test                 # Vitest suite completa
```

Se ambos passarem com exit 0, prosseguir. Se falharem:

- `tsc -b` error → Bug no TypeScript (corrigir código)
- `pnpm test` fail → Teste regrediu (investigar e corrigir)

---

## 3. Build (Vite + Electron-Builder)

```bash
pnpm run build
```

**O que faz:**
1. `tsc -b` — Compila TypeScript (src/main, src/preload)
2. `vite build` — Compila React renderer (dist/)
3. `electron-builder` — Gera instaladores (`release/*.exe`)

**Duração esperada:** 2–5 minutos (primeiros builds podem demorar mais).

**Saída esperada:**

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
| `EngrenaCode Setup 0.0.0.exe` | NSIS installer | Wizard de instalação. Escolha de diretório, atalhos. Desinstalador. |
| `EngrenaCode 0.0.0.exe` | Portable | Executável direto (sem instalação). Pode ser distribuído por USB ou portable. |

**Localização:** `apps/engrena-code/release/`

### Artefatos de Build

| Pasta | Conteúdo | Uso |
|-------|----------|-----|
| `dist-electron/` | Main + preload compilados | Empacotado no `.asar` |
| `dist/` | React app (renderer) | Empacotado no `.asar` |
| `release/` | Instaladores `.exe` | Distribuição ao usuário |

**Não versionar:** `dist/`, `dist-electron/`, `release/`. Regenerar em cada build.

---

## 5. Customizar Build

Editar `package.json` seção `"build"`:

```json
{
  "build": {
    "appId": "com.lukse.engrenacode",
    "productName": "EngrenaCode",
    "directories": {
      "output": "release",
      "buildResources": "assets"
    },
    "files": ["dist-electron", "dist/**/*"],
    "asarUnpack": ["**/node_modules/node-pty/**/*"],
    "npmRebuild": false,
    "win": {
      "target": ["nsis", "portable"]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true
    }
  }
}
```

### Para macOS (futuro)

```json
{
  "mac": {
    "target": ["dmg", "zip"]
  }
}
```

### Para Linux (futuro)

```json
{
  "linux": {
    "target": ["AppImage", "deb"]
  }
}
```

---

## 6. Ícone e Branding

- **Fonte:** `assets/icon.svg` (logo em SVG)
- **Gerado:** `assets/icon.ico` (multi-size para Windows, já commitado)
- **PNG:** `assets/icon.png` (100×100, para janela do Electron)

O `electron-builder` automáticamente:
1. Busca `icon.ico` para o executável (`.exe`)
2. Cria atalho com ícone na Desktop/Menu Iniciar
3. Embute `icon.png` na janela da aplicação

**Se o ícone sair preto:** Limpar cache do Windows Explorer:

```powershell
ie4uinit.exe -show
```

---

## 7. Validação pós-Build

### 7.1 Verificar artefatos

```powershell
# Listar release
ls apps/engrena-code/release/

# Deve conter:
# - EngrenaCode Setup 0.0.0.exe
# - EngrenaCode 0.0.0.exe
# - builder-effective-config.yaml (log do build)
```

### 7.2 Testar instalador (opcional)

```powershell
# Instalar em pasta temporária
& "apps/engrena-code/release/EngrenaCode Setup 0.0.0.exe"

# Ou testar portable direto
& "apps/engrena-code/release/EngrenaCode 0.0.0.exe"
```

Deve abrir a janela de splash → tela de unlock.

### 7.3 Testar o app executável

Depois de instalar (ou portable), abrir e rodar os [Roteiros de Homologação](./RUNBOOK-HOMOLOGACAO.md).

---

## 8. Troubleshooting

### "dist-electron não existe"

`electron-builder` não conseguiu compilar main/preload.

Solução:

```bash
rm -r dist-electron dist
pnpm exec tsc -b
pnpm run build
```

### "Cannot find file assets/icon.ico"

O `electron-builder` espera ícone multi-size.

Solução: Gerar com um editor (ex.: ImageMagick):

```bash
magick convert assets/icon.svg -define icon:auto-resize=256,128,96,64,48,32,16 assets/icon.ico
```

Ou usar um ícone existente (arquivo binário, não adicionar ao git `.gitignore` se for grande).

### "Instalador sai com erro 0x80004005"

Falha genérica do `electron-builder`. Limpar e tentar novamente:

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

Rodar o teste de integridade do `.exe`:

```powershell
Get-FileHash "apps/engrena-code/release/EngrenaCode 0.0.0.exe"
```

Comparar com hash esperado (se houver).

---

## 9. CI/CD e Automação

Em um pipeline CI (GitHub Actions, etc.), adicionar após testes verdes:

```yaml
- name: Build
  run: |
    cd apps/engrena-code
    pnpm run build
    
- name: Upload artifacts
  uses: actions/upload-artifact@v3
  with:
    name: engrena-code-release
    path: apps/engrena-code/release/
```

---

## 10. Checklist de Release

- [ ] `pnpm test` — Verde (1855/1855 testes)
- [ ] `pnpm exec tsc -b` — Zero erros
- [ ] `pnpm run build` — Exit 0
- [ ] `release/EngrenaCode Setup 0.0.0.exe` existe
- [ ] `release/EngrenaCode 0.0.0.exe` existe
- [ ] Testar instalador (Roteiro A de [`RUNBOOK-HOMOLOGACAO.md`](./RUNBOOK-HOMOLOGACAO.md))
- [ ] Testar app executável (Roteiros A–D completos)
- [ ] Sem erros no console da janela do Electron
- [ ] Sem regressões visuais (light/dark, layout)
- [ ] Versão no `package.json` atualizada (se novo semver)

---

## Leia também

- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — Quick Start (dev mode)
- [`RUNBOOK-HOMOLOGACAO.md`](./RUNBOOK-HOMOLOGACAO.md) — Validação manual (pós-build)
- [`PROGRESS.md`](./PROGRESS.md) — Estado das features (para decidir versão)
