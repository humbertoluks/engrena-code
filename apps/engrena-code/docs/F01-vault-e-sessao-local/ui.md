# Spec de UI: #login (Desbloqueio do cofre)

**Feature:** F01-vault-e-sessao-local  
**Destino:** EngrenaCode  
**Fonte de referência:** EngrenaCode (`src/renderer/screens/LoginScreen.tsx`)  
**Componente:** `src/renderer/screens/LoginScreen.tsx` (+ `ButtonPrimary.tsx`, `BrandMark.tsx`)  
**Última atualização:** 2026-08-03

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F01-vault-e-sessao-local/ui/login-unlock.png` (TODO: versionar PNG do mock) |
| Light (opcional) | N/A (fonte testada principalmente em dark) |
| Dark (opcional) | `LoginScreen.tsx` EngrenaCode + mock Workspace Unlock |

> Fonte de verdade visual = `src/renderer/screens/LoginScreen.tsx`. Anexar PNG em `docs/F01-vault-e-sessao-local/ui/` quando disponível.

## Escopo

**Inclui:** layout da tela, anatomia, copy literal, estados de UI, mapeamento de tokens/padrões de superfície, critérios de aceite visual.

**Exclui:** contratos de API/crypto/IPC (ficam no `spec.md` técnico da feature), implementação de componentes (salvo nota em "Componentes sugeridos").

## Anatomia (topo → base)

Ordem obrigatória de renderização no viewport principal:

1. Fundo de página `bg-bg` + brilho radial accent (ver Layout).
2. Card/form centralizado.
3. Linha de marca: `BrandMark` (30px) + `BrandWordmark` (não H1 genérico "EngrenaCode" solto). Decidido: manter, conforme o componente fonte.
4. Texto instrucional (`instruction`).
5. Field Workspace: label + input mono + hint.
6. Field Senha do cofre local: label + input password.
7. Slot de erro (condicional, `role="alert"`).
8. CTA primário full-width: ícone seta + `Desbloquear workspace` (`ButtonPrimary` block).
9. Nota de rodapé (segurança / filesystem local), centralizada.

**Alinhamento do card / painel:** centro do viewport (`grid min-h-screen place-items-center`); conteúdo do form alinhado à esquerda; rodapé centralizado  
**Largura máx.:** `max-w-[24rem]` (384px)

> Não usar `max-w-sm`/`max-w-md`: em Tailwind 4 os namespaces `--container-*` e `--spacing-*` alimentam `max-w-*`, e o Design Lock define `--spacing-sm: 8px`, colapsando o card.

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página | `grid min-h-screen place-items-center bg-bg p-lg` + `backgroundImage` radial | Radial: `900px 500px at 50% -10%, rgba(255,107,0,0.08), transparent 60%` |
| Card / painel | `w-full max-w-[24rem] rounded-lg border border-border bg-surface p-lg` + shadow | Shadow fonte: `shadow-[0_24px_60px_-28px_rgba(0,0,0,0.7)]` (token-gap se shadows ainda adiados) |
| Gap interno | `mb-md` / `mb-lg` / `gap-xs` entre label–input–hint | Não `space-y` único; gaps explícitos como na fonte |
| Label do campo | `text-sm font-medium text-fg` | Sentence case; **não** uppercase + tracking |
| Input | `rounded-sm border border-border bg-surface-2 px-md py-sm text-sm text-fg` | Workspace: + `font-mono`; focus `border-accent ring-2 ring-accent/40` |
| Hint / caption | `text-xs text-muted` | Sob o input Workspace |
| CTA primário | `ButtonPrimary` block: `bg-accent text-bg`, `rounded-sm`, `font-semibold`, ícone 15px | Texto escuro (`text-bg`), **não** `text-white` |
| Focus | `focus:ring-2 focus:ring-accent/40` (inputs); `focus-visible:ring-2 focus-visible:ring-accent` (botão) | |
| Erro | `text-xs text-red`; input senha com `border-red` + `ring-red/40` quando inválido | Slot fora do Field de senha, acima do CTA |

### Observado na implementação

| Item | Valor |
|------|-------|
| Marca | EngrenaCode (`BrandMark` geométrico + `BrandWordmark`) |
| Storage tema | `engrenacode:theme` (F01.1) |
| CTA texto sobre accent | `text-bg` (escuro) — não branco |
| Default workspace | `~/dev` |
| ThemeControl | Canto superior direito, fora do card |
| Acentos em strings de erro | pt-BR acentuado (PRD/spec) |

## Copy (literal — fonte de verdade)

Células = texto final no produto. Marca: somente EngrenaCode.

| Slot | Texto |
|------|-------|
| `instruction` | Desbloqueie o workspace local para abrir seus projetos e threads. |
| `label.workspace` | Workspace |
| `hint.workspace` | Diretório raiz onde o EngrenaCode indexa seus repositórios. |
| `label.password` | Senha do cofre local |
| `placeholder.password` | •••••••• |
| `cta.primary` | Desbloquear workspace |
| `cta.loading` | Desbloqueando... |
| `footer` | As chaves dos providers e o token do GitHub ficam apenas no filesystem local deste dispositivo. |
| `error.invalid` | Workspace ou senha inválidos. |
| `error.corrupted` | O cofre local está danificado ou ilegível. Restaure um backup ou recrie o workspace. |
| `error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `error.backoff` | Muitas tentativas. Tente novamente em {seconds}s. |

> Sem H1/tagline tipo “IDE Local-First…”. Sem CTA curto “Desbloquear”. Sem rodapé “Credenciais armazenadas localmente • Sem transmissão remota”.

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| workspace | text | sim | default `~/dev`; `autoComplete="off"`; `spellCheck={false}`; trim no submit; valor em `font-mono`; nunca `disabled` |
| password | password | sim | `autoComplete="current-password"`; `aria-invalid` em erro (exceto backoff); `aria-describedby` → `#login-error`; nunca `disabled` |
| submit | button | — | `ButtonPrimary` block; disabled se vazio, submitting ou backoff; ícone seta SVG + label |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount | workspace pré-preenchido `~/dev`; senha vazia; sem erro |
| `filling` | input | limpa `errorKind` no fluxo de novo submit (fonte limpa no submit) |
| `loading` | submit em andamento | `loading` + `loadingLabel` "Desbloqueando..."; botão disabled / `aria-busy`; inputs seguem editáveis |
| `disabled` | campos vazios ou backoff | CTA disabled (só o CTA) |
| `error` | invalid / corrupted / network | mensagem em `#login-error`; borda vermelha no password (se não backoff) |
| `backoff` | `retryAfterMs` ou rate limit | mensagem com `{seconds}`; CTA disabled; tick ~500ms até expirar |

## Componentes sugeridos

Compor a tela só com primitives compartilhados (não reinventar strings de classe):

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` / form surface | wrapper do form (ou classes de card documentadas) |
| `Field` | Workspace (label+input+hint) e Senha (label+input) |
| `Input` | text mono + password |
| `Button` / `ButtonPrimary` | CTA com `loading`, `loadingLabel`, `block`, ícone |
| `BrandMark` + wordmark | linha de marca no topo do card |
| Ícone seta | SVG inline 24 viewBox (path `M5 12h14M13 6l6 6-6 6`) como na fonte |

## Aceite visual

- [ ] Bate com a referência (`LoginScreen.tsx` / mock) em dark
- [ ] Anatomia na ordem documentada; sem H1 centralizado de marca fora do padrão BrandMark+wordmark
- [ ] Tabela de copy 100% aplicada (labels, hint, CTA longo, rodapé, erros)
- [ ] CTA usa `text-bg` sobre `bg-accent`, ícone + “Desbloquear workspace”
- [ ] Hint do Workspace visível sob o input
- [ ] Fundo com radial accent; card 384px + border surface
- [ ] Nenhum `max-w-*`/`w-*` com sufixo `xs|sm|md|lg|xl` (colide com `--spacing-*`)
- [ ] Estados `loading`, `disabled`, `error` e `backoff` verificáveis
- [ ] Tema via tokens (sem slate/blue ad-hoc)
- [ ] Marca EngrenaCode apenas (zero marca legada na UI)

## Decisões fechadas

| Tema | Decisão |
|------|---------|
| Linha de marca | Mantida (`BrandMark` + `BrandWordmark`) |
| `BrandMark` | Mark geométrico próprio (hexágono) |
| `ThemeControl` | Fora do card, canto superior direito (requisito F01.1) |
| Inputs em loading/backoff | Permanecem editáveis; só o CTA bloqueia reentrada |
| Acentuação | Tabela de copy deste doc prevalece |

## Perguntas em aberto

- Versionar PNG do mock em `docs/F01-vault-e-sessao-local/ui/login-unlock.png`?
- Shadow do card: promover a token ou manter valor arbitrário até o Escopo Completo de F01.1?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F01-vault-e-sessao-local/spec.md` | Contratos técnicos (API, IPC, erros de domínio) |
| `docs/F01-vault-e-sessao-local/plan.md` | Ordem de implementação |
| `docs/F01-vault-e-sessao-local/copy.md` | Catálogo de microcopy |
| `docs/design-system/` | Tokens e padrões de superfície |
| `docs/F01.1-design-system/spec.md` | Tema, tokens, padrões de superfície |
| `_reversa_sdd/renderer/vault-gate/` | Comportamento legado (não substitui este SDD) |
