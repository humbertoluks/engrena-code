# Spec de UI: #rules (Rules)

**Feature:** F06-rules  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`RulesScreen`, `RuleFormModal`, `ProjectRulesModal`)  
**Componente destino:** `src/renderer/screens/RulesScreen.tsx` (+ form/modal; vínculo no Workspace F03)  
**Última atualização:** 2026-08-03

## Escopo

**Inclui:** tela `#rules` (CRUD global), formulário create/edit, estados empty/error/loading, tokens F01.1, copy EngrenaCode; superfície de vínculo/supressão no Workspace (modal Repo Harness) quando F03 existir.

**Exclui:** contratos HTTP/SQL (spec.md); drag-and-drop de ordem; hard cap 15; seed obrigatório de defaults.

## Anatomia `#rules`

1. Header: título “Rules” + CTA “Nova rule”
2. Busca / filtro por categoria (opcional)
3. Grid de cards: name, badge Global (âmbar se `isGlobal`), enabled toggle, ações editar/excluir
4. Empty: “Nenhuma rule ainda. Crie a primeira…”
5. Modal form: name, description opcional, category opcional, content markdown, checkboxes Global + Habilitada

## Anatomia vínculo (Workspace)

Modal projeto: seção Globais (toggle ativa neste projeto / pill “suprimida aqui”) + seção Deste projeto (vínculo on/off) + rodapé `N ativas · ~X KB` + aviso âmbar se N > 15.

## Copy (EngrenaCode)

| Slot | Texto |
|------|-------|
| `rules.title` | Rules |
| `rules.cta.new` | Nova rule |
| `rules.empty` | Nenhuma rule ainda. Crie a primeira… |
| `rules.error.load` | Não foi possível carregar as rules. |
| `rules.error.delete` | Não foi possível excluir a rule. |
| `rules.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `rules.error.nameConflict` | Já existe uma rule com este nome. |
| `rules.error.nameChars` | O nome não pode conter quebras de linha ou caracteres de controle. |
| `rules.form.global.hint` | Entra em todo turno; dá para suprimir projeto a projeto no Workspace. |
| `rules.project.error.load` | Não foi possível carregar as rules do projeto. |
| `rules.project.error.link` | Não foi possível atualizar o vínculo. |
| `rules.cap.warn` | Mais de 15 rules ativas neste projeto — considere enxugar (não bloqueia). |

## Aceite visual

- [ ] `#rules` com CRUD e badge Global
- [ ] Light/dark via tokens F01.1
- [ ] Copy EngrenaCode (sem LionCode)
- [ ] Modal de projeto (quando F03): supressão global ≠ vínculo local
