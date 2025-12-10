import * as crypto from 'crypto'

// ProductionRequirement: Output from calculator query

export interface ProductionRequirement {
  // Input specification
  targetItem: string // Primary item being produced
  targetRate: number // Desired production rate
  rateUnit: string // 's' | 'm' | 'h'

  // Calculator metadata
  calculatorUrl: string // Full URL for reproducibility
  factorioVersion: string // Game version used

  // Machine requirements
  machines: Array<{
    type: string // Machine entity ID (e.g., "assembling-machine-2")
    recipe: string // Recipe being crafted (e.g., "iron-plate")
    count: number // Number of machines needed (may be fractional)
  }>

  // Input resource requirements
  inputs: Array<{
    resource: string // Resource entity ID (e.g., "iron-ore")
    rate: number // Required input rate (units per rateUnit)
  }>

  // Production chain dependencies (intermediate products)
  dependencies: Array<{
    item: string // Intermediate product (e.g., "iron-gear-wheel")
    rate: number // Required production rate
  }>

  // Metadata
  timestamp: string // ISO 8601 timestamp of calculation
  cacheKey: string // SHA-256 hash of calculator URL (for cache lookup)
}

export interface ValidationError {
  field: string
  message: string
}

export function validateProductionRequirement(data: unknown): ProductionRequirement | ValidationError {
  if (!data || typeof data !== 'object') {
    return { field: 'root', message: 'Invalid requirement: must be an object' }
  }

  const req = data as Partial<ProductionRequirement>

  // Validate required string fields
  if (typeof req.targetItem !== 'string' || req.targetItem.trim() === '') {
    return { field: 'targetItem', message: 'Target item must be a non-empty string' }
  }

  if (typeof req.targetRate !== 'number' || req.targetRate <= 0) {
    return { field: 'targetRate', message: 'Target rate must be a positive number' }
  }

  if (typeof req.rateUnit !== 'string' || !['s', 'm', 'h'].includes(req.rateUnit)) {
    return { field: 'rateUnit', message: 'Rate unit must be one of: s, m, h' }
  }

  // Validate calculator URL
  if (typeof req.calculatorUrl !== 'string' || !req.calculatorUrl.startsWith('https://kirkmcdonald.github.io')) {
    return { field: 'calculatorUrl', message: 'Calculator URL must be a valid kirkmcdonald.github.io HTTPS URL' }
  }

  if (typeof req.factorioVersion !== 'string' || req.factorioVersion.trim() === '') {
    return { field: 'factorioVersion', message: 'Factorio version must be a non-empty string' }
  }

  // Validate machines array
  if (!Array.isArray(req.machines)) {
    return { field: 'machines', message: 'Machines must be an array' }
  }

  for (let i = 0; i < req.machines.length; i++) {
    const machine = req.machines[i]
    if (!machine || typeof machine !== 'object') {
      return { field: `machines[${i}]`, message: 'Each machine must be an object' }
    }
    if (typeof machine.type !== 'string') {
      return { field: `machines[${i}].type`, message: 'Machine type must be a string' }
    }
    if (typeof machine.recipe !== 'string') {
      return { field: `machines[${i}].recipe`, message: 'Machine recipe must be a string' }
    }
    if (typeof machine.count !== 'number' || machine.count < 0) {
      return { field: `machines[${i}].count`, message: 'Machine count must be a non-negative number' }
    }
  }

  // Validate inputs array
  if (!Array.isArray(req.inputs)) {
    return { field: 'inputs', message: 'Inputs must be an array' }
  }

  for (let i = 0; i < req.inputs.length; i++) {
    const input = req.inputs[i]
    if (!input || typeof input !== 'object') {
      return { field: `inputs[${i}]`, message: 'Each input must be an object' }
    }
    if (typeof input.resource !== 'string') {
      return { field: `inputs[${i}].resource`, message: 'Input resource must be a string' }
    }
    if (typeof input.rate !== 'number' || input.rate <= 0) {
      return { field: `inputs[${i}].rate`, message: 'Input rate must be a positive number' }
    }
  }

  // Validate dependencies array (optional, defaults to empty)
  if (req.dependencies !== undefined && !Array.isArray(req.dependencies)) {
    return { field: 'dependencies', message: 'Dependencies must be an array' }
  }

  // Validate timestamp (ISO 8601 format)
  if (typeof req.timestamp !== 'string' || isNaN(Date.parse(req.timestamp))) {
    return { field: 'timestamp', message: 'Timestamp must be a valid ISO 8601 date string' }
  }

  if (typeof req.cacheKey !== 'string' || req.cacheKey.trim() === '') {
    return { field: 'cacheKey', message: 'Cache key must be a non-empty string' }
  }

  return req as ProductionRequirement
}

// Generate cache key from calculator URL
export function getCacheKey(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').substring(0, 16)
}

// Create ProductionRequirement from calculator results
export function createProductionRequirement(
  targetItem: string,
  targetRate: number,
  rateUnit: string,
  calculatorUrl: string,
  factorioVersion: string,
  machines: ProductionRequirement['machines'],
  inputs: ProductionRequirement['inputs'],
  dependencies: ProductionRequirement['dependencies'] = []
): ProductionRequirement {
  return {
    targetItem,
    targetRate,
    rateUnit,
    calculatorUrl,
    factorioVersion,
    machines,
    inputs,
    dependencies,
    timestamp: new Date().toISOString(),
    cacheKey: getCacheKey(calculatorUrl)
  }
}
