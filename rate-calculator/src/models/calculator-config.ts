// CalculatorConfig: Input configuration for Kirk McDonald calculator query
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

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
export function buildCalculatorUrl(config: CalculatorConfig, useZipEncoding: boolean = false): string {
  const baseUrl = 'https://kirkmcdonald.github.io/calc.html#'

  if (useZipEncoding) {
    // Build compressed URL using the zip parameter
    // This requires the query string to be zlib-compressed and base64-encoded
    return buildCalculatorUrlWithZip(config, baseUrl)
  }

  // Original uncompressed URL format
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

// Build calculator URL using zlib compression and base64 encoding
function buildCalculatorUrlWithZip(config: CalculatorConfig, baseUrl: string): string {
  const zlib = require('zlib')
  const Buffer = require('buffer').Buffer

  // Convert version to data format
  const dataVersion = config.version === '1.1' ? '1-1-110' : '2-0-55'

  // Build items parameter
  const itemsParam = config.items
    .map(item => `${item.name}:r:${item.rate}`)
    .join(',')

  // Build buildings parameter
  const buildingsParam = [
    config.technology.assembler,
    config.technology.furnace
  ].join(',')

  // Build the query string
  const queryParams = [
    `data=${dataVersion}`,
    `buildings=${buildingsParam}`,
    `items=${itemsParam}`
  ]
  const queryString = queryParams.join('&')

  try {
    // Use deflateRaw (raw deflate without zlib header) for Kirk McDonald's format
    const compressed = zlib.deflateRawSync(Buffer.from(queryString))
    const encoded = compressed.toString('base64')
    return baseUrl + `zip=${encoded}`
  } catch (error) {
    // Fallback to uncompressed if compression fails
    console.error('Zip encoding failed, using uncompressed URL:', error)
    return baseUrl + queryParams.join('&')
  }
}

// Parse a zip-encoded calculator URL and extract config
export function parseCalculatorZipUrl(zipEncoded: string): CalculatorConfig | null {
  try {
    const zlib = require('zlib')
    const Buffer = require('buffer').Buffer

    // Decode from base64
    const compressed = Buffer.from(zipEncoded, 'base64')
    // Decompress using inflateRaw (raw deflate without zlib header)
    const decompressed = zlib.inflateRawSync(compressed)
    const queryString = decompressed.toString('utf-8')

    // Parse the query string
    const params = new URLSearchParams(queryString)

    // Extract version
    const dataParam = params.get('data') || '2-0-55'
    const version = dataParam.startsWith('1-1') ? '1.1' : '2.0'

    // Extract rate unit (not in zip format, default to 'm')
    const rateUnit = 'm' as const

    // Extract buildings (single building in Kirk's format, we'll assume assembler)
    const buildingsStr = params.get('buildings') || 'assembling-machine-2'
    const buildings = buildingsStr.split(',')

    // Extract items
    const itemsStr = params.get('items') || ''
    const items = itemsStr.split(',').map(item => {
      const parts = item.split(':r:')
      return {
        name: parts[0] || '',
        rate: parseFloat(parts[1] || '1')
      }
    }).filter(item => !isNaN(item.rate) && item.name.trim())

    if (items.length === 0) {
      return null
    }

    return {
      items,
      rateUnit,
      technology: {
        assembler: buildings[0] || 'assembling-machine-2',
        furnace: buildings[1] || 'stone-furnace',
        miner: 'electric-mining-drill',
        belt: 'fast-transport-belt'
      },
      version
    }
  } catch (error) {
    console.error('Failed to parse zip-encoded URL:', error)
    return null
  }
}
