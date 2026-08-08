# Catálogo de copy: F20-memoria-persistente

**Produto:** EngrenaCode
**Fonte:** nenhuma string literal aproveitada — a fonte (`LionCodeLabs/.../ProjectMemoryModal.tsx`) descreve capacidades que não existem no F20 Engrena (edição com CAS, dreaming, anomalia, teto em KiB, limpar/resetar). Copy escrita para o contrato real.
**Última atualização:** 2026-08-07

Strings literais para UI. `ui.md` e código devem usar estes textos — não reinventar.

## Convenção de ids

`memory.{{slot}}`
Exemplos: `memory.row.label`, `memory.modal.title`, `memory.toggle.on`.

## Telas

### memory.row (linha no Repo Harness, `WorkspaceSidebar`)

| Id | Texto | Notas |
|----|-------|-------|
| `memory.row.label` | Memória | Label da 5ª linha do Repo Harness |
| `memory.row.meta.entriesOne` | {n} entrada | `enabled`, `entryCount === 1` |
| `memory.row.meta.entriesMany` | {n} entradas | `enabled`, `entryCount !== 1` |
| `memory.row.meta.disabled` | desligada | `enabled === false` |
| `memory.row.meta.corrupted` | journal ilegível | `corrupted === true`, precede os demais |

### memory.modal (`ProjectMemoryModal`)

| Id | Texto | Notas |
|----|-------|-------|
| `memory.modal.title` | Memória do projeto | |
| `memory.modal.pillEntries` | {n} entradas | Pill mono ao lado do título |
| `memory.modal.ariaClose` | Fechar | `aria-label` do `×` |
| `memory.toggle.label` | Memória neste projeto | Label do pill on/off |
| `memory.toggle.on` | on | |
| `memory.toggle.off` | off | |
| `memory.toggle.titleOn` | Ligada — o agente lê o journal antes do turno e escreve uma entrada ao fim | `title` quando on |
| `memory.toggle.titleOff` | Desligada — nenhuma entrada nova é escrita e o journal não entra no prompt | `title` quando off |
| `memory.notice.disabled` | Memória desligada. O journal existente foi preservado e volta a ser usado quando você religar. | Texto muted |
| `memory.notice.corrupted` | Journal ilegível — o conteúdo anterior não pôde ser decifrado e está sendo tratado como vazio. Novas entradas voltam a ser gravadas normalmente. | `role="alert"` âmbar |
| `memory.journal.loading` | Carregando journal… | |
| `memory.journal.empty` | Sem entradas ainda. O agente escreve aqui ao fim de cada turno. | |
| `memory.footer.lastEntry` | Última entrada: {lastEntryAt} | Rodapé mono |
| `memory.footer.lastEntryNever` | Nenhuma entrada ainda | Quando `lastEntryAt === null` |
| `memory.footer.size` | {kb} no journal | `sizeBytes` formatado em KB |
| `memory.error.load` | Não foi possível carregar o journal deste projeto. | `role="alert"` vermelho |
| `memory.error.toggle` | Não foi possível alterar a memória deste projeto. | `role="alert"` vermelho |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{n}` | `entryCount` do status |
| `{lastEntryAt}` | Timestamp da última entrada, formatado no locale pt-BR |
| `{kb}` | `sizeBytes` formatado (ex.: `3,2 KB`) |

## Lacunas

Nenhuma. Todo slot da anatomia em `ui.md` tem string definida.
