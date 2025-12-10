// CalculatorConfig: Input configuration for Kirk McDonald calculator query

export interface CalculatorConfig {
  // Target items to produce
  items: Array<{
    name: string // Factorio item ID (e.g., "automation-science-pack")
    rate: number // Desired production rate
  }>

  // Time unit for rates
  rateUnit: 's' | 'm' | 'h' // second, minute, hour

  // Technology levels (affects machine selection)
  technology: {
    assembler: string // "assembling-machine-1" | "assembling-machine-2" | "assembling-machine-3"
    furnace: string // "stone-furnace" | "steel-furnace" | "electric-furnace"
    miner: string // "burner-mining-drill" | "electric-mining-drill"
    belt: string // "transport-belt" | "fast-transport-belt" | "express-transport-belt"
  }

  // Factorio game version
  version: string // e.g., "1.1", "1.2"
}

export interface ValidationError {
  field: string
  message: string
}

export function validateCalculatorConfig(data: unknown): CalculatorConfig | ValidationError {
  if (!data || typeof data !== 'object') {
    return { field: 'root', message: 'Invalid config: must be an object' }
  }

  const config = data as Partial<CalculatorConfig>

  // Validate items
  if (!Array.isArray(config.items) || config.items.length === 0) {
    return { field: 'items', message: 'Items must be a non-empty array' }
  }

  for (let i = 0; i < config.items.length; i++) {
    const item = config.items[i]
    if (!item || typeof item !== 'object') {
      return { field: `items[${i}]`, message: 'Each item must be an object' }
    }
    if (typeof item.name !== 'string' || item.name.trim() === '') {
      return { field: `items[${i}].name`, message: 'Item name must be a non-empty string' }
    }
    if (typeof item.rate !== 'number' || item.rate <= 0) {
      return { field: `items[${i}].rate`, message: 'Item rate must be a positive number' }
    }
  }

  // Validate rateUnit
  if (!config.rateUnit || !['s', 'm', 'h'].includes(config.rateUnit)) {
    return { field: 'rateUnit', message: 'Rate unit must be one of: s, m, h' }
  }

  // Validate technology
  if (!config.technology || typeof config.technology !== 'object') {
    return { field: 'technology', message: 'Technology must be an object' }
  }

  const requiredTechFields = ['assembler', 'furnace', 'miner', 'belt']
  for (const field of requiredTechFields) {
    const value = (config.technology as any)[field]
    if (typeof value !== 'string' || value.trim() === '') {
      return { field: `technology.${field}`, message: `${field} must be a non-empty string` }
    }
  }

  // Validate version
  if (typeof config.version !== 'string' || config.version.trim() === '') {
    return { field: 'version', message: 'Version must be a non-empty string' }
  }

  return config as CalculatorConfig
}

// Build calculator URL from config
export function buildCalculatorUrl(config: CalculatorConfig): string {
  const baseUrl = 'https://kirkmcdonald.github.io/calc.html#'

  // Convert version to data format (e.g., "1.1" -> "1-1-110" or use default "2-0-55")
  const dataVersion = config.version === '1.1' ? '1-1-110' : '2-0-55'

  // Build items parameter (e.g., "automation-science-pack:r:60")
  const itemsParam = config.items
    .map(item => `${item.name}:r:${item.rate}`)
    .join(',')

  // Build buildings parameter (assembler,furnace,miner order matters)
  const buildingsParam = [
    config.technology.assembler,
    config.technology.furnace
  ].join(',')

  const params = [
    `data=${dataVersion}`,
    `rate=${config.rateUnit}`,
    `buildings=${buildingsParam}`,
    `items=${itemsParam}`
  ]

  return baseUrl + params.join('&')
}
