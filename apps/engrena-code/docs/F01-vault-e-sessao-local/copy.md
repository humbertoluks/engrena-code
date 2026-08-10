# Catálogo de copy: F01-vault-e-sessao-local

**Produto:** EngrenaCode  
**Fonte:** `src/renderer/screens/LoginScreen.tsx`  
**Última atualização:** 2026-08-03

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto. Marca: somente EngrenaCode.

## Convenção de ids

`{idTela}.{slot}`  
Exemplos: `login.instruction`, `login.label.workspace`, `login.cta.primary`, `login.error.invalid`.

## Telas

### login (`#login`)

| Id | Texto | Notas |
|----|-------|-------|
| `login.instruction` | Desbloqueie o workspace local para abrir seus projetos e threads. | |
| `login.label.workspace` | Workspace | |
| `login.hint.workspace` | Diretório raiz onde o EngrenaCode indexa seus repositórios. | |
| `login.label.password` | Senha do cofre local | |
| `login.placeholder.password` | •••••••• | |
| `login.cta.primary` | Desbloquear workspace | com ícone seta |
| `login.cta.loading` | Desbloqueando... | `ButtonPrimary` loadingLabel |
| `login.footer` | As chaves dos providers e o token do GitHub ficam apenas no filesystem local deste dispositivo. | |
| `login.error.invalid` | Workspace ou senha inválidos. | pt-BR acentuado |
| `login.error.corrupted` | O cofre local está danificado ou ilegível. Restaure um backup ou recrie o workspace. | |
| `login.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | |
| `login.error.backoff` | Muitas tentativas. Tente novamente em {seconds}s. | |

### Strings proibidas nesta tela (não reintroduzir)

| Texto errado | Usar em vez disso |
|--------------|-------------------|
| `Desbloquear` (CTA curto) | `login.cta.primary` |
| `Senha` (label curto) | `login.label.password` |
| `IDE Local-First para Agentes de IA` | N/A — não existe |
| `Credenciais armazenadas localmente • Sem transmissão remota` | `login.footer` |
| H1 centralizado `EngrenaCode` fora do padrão marca | BrandMark + wordmark no topo do card |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{seconds}` | segundos restantes de backoff (`Math.ceil(remainingMs / 1000)`) |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `login.brand.wordmark` | Wordmark via `BrandWordmark` (`Engrena` + `Code` accent) | OK |
| Default value workspace | Valor inicial `~/dev` é UX, não copy de label — documentado no `ui.md` | OK |
