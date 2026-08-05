import { getDb } from '../client.js'
import { recalculateNullCosts, type PricingSnapshot } from './usage-events.js'

export interface ModelPricing {
  id: string
  provider: string
  model: string
  inputPerMTok: number
  outputPerMTok: number
  cacheReadPerMTok: number | null
  cacheWritePerMTok: number | null
  approximate: boolean
  source: string | null
  createdAt: number
  updatedAt: number
}

interface ModelPricingRow {
  id: string
  provider: string
  model: string
  input_per_mtok: number
  output_per_mtok: number
  cache_read_per_mtok: number | null
  cache_write_per_mtok: number | null
  approximate: number
  source: string | null
  created_at: number
  updated_at: number
}

function toModelPricing(row: ModelPricingRow): ModelPricing {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    inputPerMTok: row.input_per_mtok,
    outputPerMTok: row.output_per_mtok,
    cacheReadPerMTok: row.cache_read_per_mtok,
    cacheWritePerMTok: row.cache_write_per_mtok,
    approximate: row.approximate === 1,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toPricingSnapshot(pricing: ModelPricing): PricingSnapshot {
  return {
    inputPerMTok: pricing.inputPerMTok,
    outputPerMTok: pricing.outputPerMTok,
    cacheReadPerMTok: pricing.cacheReadPerMTok,
    cacheWritePerMTok: pricing.cacheWritePerMTok,
    approximate: pricing.approximate,
  }
}

export class PricingError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** `price_<provider>_<model>` sanitizado — id determinístico (spec F11 §3.2), aproveitando o par único `(provider, model)`. */
function sanitizeIdPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function findPricing(provider: string, model: string | null): ModelPricing | null {
  if (model === null) return null
  const row = getDb().prepare(`SELECT * FROM model_pricing WHERE provider = ? AND model = ?`).get(provider, model) as
    | ModelPricingRow
    | undefined
  return row === undefined ? null : toModelPricing(row)
}

export function getPricingById(id: string): ModelPricing | null {
  const row = getDb().prepare(`SELECT * FROM model_pricing WHERE id = ?`).get(id) as ModelPricingRow | undefined
  return row === undefined ? null : toModelPricing(row)
}

export function listPricing(): ModelPricing[] {
  const rows = getDb().prepare(`SELECT * FROM model_pricing ORDER BY provider, model`).all() as unknown as ModelPricingRow[]
  return rows.map(toModelPricing)
}

export interface CreatePricingInput {
  provider: string
  model: string
  inputPerMTok: number
  outputPerMTok: number
  cacheReadPerMTok?: number | null
  cacheWritePerMTok?: number | null
  approximate?: boolean
  source?: string | null
}

export interface PricingMutationResult {
  pricing: ModelPricing
  recalculatedEvents: number
}

export function createPricing(input: CreatePricingInput): PricingMutationResult {
  if (findPricing(input.provider, input.model)) {
    throw new PricingError('pricing_conflict', `Já existe preço cadastrado para ${input.provider}/${input.model}.`)
  }

  const id = `price_${sanitizeIdPart(input.provider)}_${sanitizeIdPart(input.model)}`
  const now = Date.now()

  try {
    getDb()
      .prepare(
        `INSERT INTO model_pricing (
          id, provider, model, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok,
          approximate, source, created_at, updated_at
        ) VALUES (@id, @provider, @model, @inputPerMTok, @outputPerMTok, @cacheReadPerMTok, @cacheWritePerMTok,
          @approximate, @source, @createdAt, @updatedAt)`
      )
      .run({
        id,
        provider: input.provider,
        model: input.model,
        inputPerMTok: input.inputPerMTok,
        outputPerMTok: input.outputPerMTok,
        cacheReadPerMTok: input.cacheReadPerMTok ?? null,
        cacheWritePerMTok: input.cacheWritePerMTok ?? null,
        approximate: input.approximate ? 1 : 0,
        source: input.source ?? null,
        createdAt: now,
        updatedAt: now,
      })
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      throw new PricingError('pricing_conflict', `Já existe preço cadastrado para ${input.provider}/${input.model}.`)
    }
    throw err
  }

  const pricing = getPricingById(id) as ModelPricing
  const recalculatedEvents = recalculateNullCosts(pricing.provider, pricing.model, toPricingSnapshot(pricing))
  return { pricing, recalculatedEvents }
}

export interface UpdatePricingInput {
  inputPerMTok?: number
  outputPerMTok?: number
  cacheReadPerMTok?: number | null
  cacheWritePerMTok?: number | null
  approximate?: boolean
  source?: string | null
}

/** `provider`/`model` são imutáveis após criação (spec F11 §5.2) — mudar exigiria criar outro registro. */
export function updatePricing(id: string, input: UpdatePricingInput): PricingMutationResult {
  const existing = getPricingById(id)
  if (!existing) throw new PricingError('not_found', 'Preço não encontrado.')

  const next: ModelPricing = {
    ...existing,
    inputPerMTok: input.inputPerMTok ?? existing.inputPerMTok,
    outputPerMTok: input.outputPerMTok ?? existing.outputPerMTok,
    cacheReadPerMTok: input.cacheReadPerMTok !== undefined ? input.cacheReadPerMTok : existing.cacheReadPerMTok,
    cacheWritePerMTok: input.cacheWritePerMTok !== undefined ? input.cacheWritePerMTok : existing.cacheWritePerMTok,
    approximate: input.approximate ?? existing.approximate,
    source: input.source !== undefined ? input.source : existing.source,
    updatedAt: Date.now(),
  }

  getDb()
    .prepare(
      `UPDATE model_pricing SET
        input_per_mtok = @inputPerMTok, output_per_mtok = @outputPerMTok,
        cache_read_per_mtok = @cacheReadPerMTok, cache_write_per_mtok = @cacheWritePerMTok,
        approximate = @approximate, source = @source, updated_at = @updatedAt
       WHERE id = @id`
    )
    .run({
      id,
      inputPerMTok: next.inputPerMTok,
      outputPerMTok: next.outputPerMTok,
      cacheReadPerMTok: next.cacheReadPerMTok,
      cacheWritePerMTok: next.cacheWritePerMTok,
      approximate: next.approximate ? 1 : 0,
      source: next.source,
      updatedAt: next.updatedAt,
    })

  const pricing = getPricingById(id) as ModelPricing
  const recalculatedEvents = recalculateNullCosts(pricing.provider, pricing.model, toPricingSnapshot(pricing))
  return { pricing, recalculatedEvents }
}
