import { resolveForTurn, type Rule } from '../db/repositories/rules.js'
import { filterByModeCatalog } from '../prompts/prompt-spec.js'
import { composeRulesBlock } from './rules-block.js'

export const RuleRegistry = {
  resolveForTurn(projectId: string): Rule[] {
    return resolveForTurn(projectId)
  },

  /**
   * `allowedNames` vem do modo de chat (F28 §3.4) e **filtra** o que o projeto já vincula;
   * `null` mantém o comportamento de sempre (todas as rules ativas do projeto).
   */
  composeBlockForTurn(projectId: string, allowedNames: readonly string[] | null = null): string {
    return composeRulesBlock(filterByModeCatalog(this.resolveForTurn(projectId), allowedNames))
  },
}
