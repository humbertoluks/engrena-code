import { resolveForTurn, type Rule } from '../db/repositories/rules.js'
import { composeRulesBlock } from './rules-block.js'

export const RuleRegistry = {
  resolveForTurn(projectId: string): Rule[] {
    return resolveForTurn(projectId)
  },

  composeBlockForTurn(projectId: string): string {
    return composeRulesBlock(this.resolveForTurn(projectId))
  },
}
