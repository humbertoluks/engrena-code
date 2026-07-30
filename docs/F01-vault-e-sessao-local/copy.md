# Catálogo de copy: F01-vault-e-sessao-local

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs `packages/renderer/src/screens/LoginScreen.tsx`  
**Mapa de rename:** `LionCode → EngrenaCode`  
**Última atualização:** 2026-07-30

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{idTela}.{slot}`  
Exemplos: `login.instruction`, `login.label.workspace`, `login.cta.primary`, `login.error.invalid`.

## Telas

### login (`#login`)

| Id | Texto | Notas |
|----|-------|-------|
| `login.instruction` | Desbloqueie o workspace local para abrir seus projetos e threads. | |
| `login.label.workspace` | Workspace | |
| `login.hint.workspace` | Diretório raiz onde o EngrenaCode indexa seus repositórios. | rename + acentos destino |
| `login.label.password` | Senha do cofre local | |
| `login.placeholder.password` | •••••••• | |
| `login.cta.primary` | Desbloquear workspace | com ícone seta |
| `login.cta.loading` | Desbloqueando... | `ButtonPrimary` loadingLabel |
| `login.footer` | As chaves dos providers e o token do GitHub ficam apenas no filesystem local deste dispositivo. | |
| `login.error.invalid` | Workspace ou senha inválidos. | F01 acentuado (fonte LionCode sem acento) |
| `login.error.corrupted` | O cofre local está danificado ou ilegível. Restaure um backup ou recrie o workspace. | |
| `login.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | |
| `login.error.backoff` | Muitas tentativas. Tente novamente em {seconds}s. | |

### Strings proibidas nesta tela (não reintroduzir)

| Texto errado (visto no EngrenaCode atual) | Usar em vez disso |
|-------------------------------------------|-------------------|
| `Desbloquear` (CTA curto) | `login.cta.primary` |
| `Senha` (label curto) | `login.label.password` |
| `IDE Local-First para Agentes de IA` | N/A — não existe na fonte |
| `Credenciais armazenadas localmente • Sem transmissão remota` | `login.footer` |
| H1 centralizado `EngrenaCode` fora do padrão marca | BrandMark + wordmark no topo do card |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{seconds}` | segundos restantes de backoff (`Math.ceil(remainingMs / 1000)`) |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `login.brand.wordmark` | Texto/exibição da marca EngrenaCode ainda não definido (fonte = LionCode) | TODO |
| Default value workspace | Valor inicial `~/dev` é UX, não copy de label — documentado no `ui.md` | OK |
