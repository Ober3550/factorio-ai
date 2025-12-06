/**
 * Rate Calculator - Replicates Factorio's in-game Rate Calculator tool
 * 
 * Reads entity counts from a blueprint and calculates throughput based on:
 * 1. Belt transfer speed (items/min through a belt)
 * 2. Inserter transfer speed (items/min via inserters)
 * 
 * By default shows: base transport-belt and base inserter rates
 * Optional flags: --belt-type, --inserter-type, --research
 */

import { promises as fs } from 'fs'
import * as path from 'path'

// Inserter specifications
const INSERTER_SPECS: Record<string, { baseStack: number; maxResearchStack: number; swingTicks: number }> = {
  'burner-inserter': { baseStack: 1, maxResearchStack: 4, swingTicks: 76 },
  'inserter': { baseStack: 1, maxResearchStack: 4, swingTicks: 70 },
  'long-handed-inserter': { baseStack: 1, maxResearchStack: 4, swingTicks: 50 },
  'fast-inserter': { baseStack: 1, maxResearchStack: 4, swingTicks: 24 },
  'bulk-inserter': { baseStack: 2, maxResearchStack: 12, swingTicks: 24 },
  'stack-inserter': { baseStack: 6, maxResearchStack: 16, swingTicks: 24 },
}

// Belt speeds in items per second per lane
// Base: 15 items/s, Fast: 30 items/s (2x), Express: 45 items/s (3x), Turbo: 60 items/s (4x)
const BELT_SPEEDS: Record<string, number> = {
  'transport-belt': 15,
  'fast-transport-belt': 30,
  'express-transport-belt': 45,
  'turbo-transport-belt': 60,
}

interface RateCalculation {
  furnaces: number
  furnaceRate: number // items/min per furnace
  totalProductionRate: number // items/min all furnaces
  
  beltTransfer: Record<string, {
    itemsPerSec: number
    itemsPerMin: number
    lanesRequired: number
  }>
  
  inserterTransfer: Record<string, {
    base: {
      itemsPerSec: number
      itemsPerMin: number
      insertersRequired: number
    }
    maxResearch: {
      itemsPerSec: number
      itemsPerMin: number
      insertersRequired: number
    }
  }>
}

/**
 * Furnace specifications
 * Smelting time: 3.2 seconds = 192 ticks per item
 * Energy consumption: 90,000 joules per second per furnace
 * 
 * Production rate: 1 / 3.2 = 0.3125 items/second = 18.75 items/minute per furnace
 */
const FURNACE_SPECS = {
  smeltTimeSeconds: 3.2,
  energyConsumptionJoulesPerSecond: 90000,
}

/**
 * Fuel energy content in joules
 */
const FUEL_ENERGY: Record<string, number> = {
  'coal': 4_000_000,
  'solid-fuel': 12_000_000,
  'wood': 1_000_000,
  'nuclear-fuel': 1_200_000_000,
}

/**
 * Calculate furnace production rate.
 * Base smelting recipe: 3.2 seconds per item
 * Therefore: 1 / 3.2 = 0.3125 items/second = 18.75 items/minute
 */
function getFurnaceRate(): number {
  // Furnace smelts 1 item every 3.2 seconds = 60 / 3.2 items per minute = 18.75 items/min
  return 60 / FURNACE_SPECS.smeltTimeSeconds // items/minute per furnace
}

/**
 * Calculate belt throughput for all belt types.
 */
function calculateBeltTransfer(itemsPerMinRequired: number): Record<string, { itemsPerSec: number; itemsPerMin: number; lanesRequired: number }> {
  const result: Record<string, { itemsPerSec: number; itemsPerMin: number; lanesRequired: number }> = {}
  
  for (const [beltName, speedPerSec] of Object.entries(BELT_SPEEDS)) {
    const itemsPerMin = speedPerSec * 60
    const lanesRequired = Math.ceil(itemsPerMinRequired / itemsPerMin)
    
    result[beltName] = {
      itemsPerSec: speedPerSec,
      itemsPerMin,
      lanesRequired,
    }
  }
  
  return result
}

/**
 * Calculate inserter throughput at both research levels.
 */
function calculateInserterTransfer(itemsPerMinRequired: number): Record<string, { base: any; maxResearch: any }> {
  const result: Record<string, { base: any; maxResearch: any }> = {}
  
  for (const [inserterName, spec] of Object.entries(INSERTER_SPECS)) {
    const ticksPerSecond = 60
    const swingTimeSeconds = spec.swingTicks / ticksPerSecond
    
    // Base research
    const baseItemsPerSec = spec.baseStack / swingTimeSeconds
    const baseItemsPerMin = baseItemsPerSec * 60
    const baseInsertionsRequired = Math.ceil(itemsPerMinRequired / baseItemsPerMin)
    
    // Max research
    const maxItemsPerSec = spec.maxResearchStack / swingTimeSeconds
    const maxItemsPerMin = maxItemsPerSec * 60
    const maxInsertionsRequired = Math.ceil(itemsPerMinRequired / maxItemsPerMin)
    
    result[inserterName] = {
      base: {
        itemsPerSec: baseItemsPerSec,
        itemsPerMin: baseItemsPerMin,
        insertersRequired: baseInsertionsRequired,
      },
      maxResearch: {
        itemsPerSec: maxItemsPerSec,
        itemsPerMin: maxItemsPerMin,
        insertersRequired: maxInsertionsRequired,
      },
    }
  }
  
  return result
}

/**
 * Main rate calculation for a given number of furnaces.
 */
function calculateRate(furnaceCount: number): RateCalculation {
  const furnaceRate = getFurnaceRate()
  const totalProductionRate = furnaceCount * furnaceRate
  
  const beltTransfer = calculateBeltTransfer(totalProductionRate)
  const inserterTransfer = calculateInserterTransfer(totalProductionRate)
  
  return {
    furnaces: furnaceCount,
    furnaceRate,
    totalProductionRate,
    beltTransfer,
    inserterTransfer,
  }
}

/**
 * Generate a formatted report similar to the in-game calculator.
 */
function generateReport(furnaceCount: number): string {
  const calc = calculateRate(furnaceCount)
  
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    'FACTORIO RATE CALCULATOR',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Configuration:`,
    `  Furnaces: ${calc.furnaces}`,
    `  Per furnace: ${calc.furnaceRate} items/min`,
    `  Total production: ${calc.totalProductionRate} items/min`,
    '',
    '───────────────────────────────────────────────────────────────',
    'BELT TRANSFER RATES',
    '───────────────────────────────────────────────────────────────',
    '',
  ]
  
  for (const [beltName, data] of Object.entries(calc.beltTransfer)) {
    lines.push(`${beltName}:`)
    lines.push(`  Speed: ${data.itemsPerSec.toFixed(2)} items/s = ${data.itemsPerMin.toFixed(1)} items/min`)
    lines.push(`  Lanes required: ${data.lanesRequired}`)
    lines.push('')
  }
  
  lines.push('───────────────────────────────────────────────────────────────')
  lines.push('INSERTER TRANSFER RATES')
  lines.push('───────────────────────────────────────────────────────────────')
  lines.push('')
  
  for (const [inserterName, data] of Object.entries(calc.inserterTransfer)) {
    lines.push(`${inserterName}:`)
    lines.push(`  Base research:`)
    lines.push(`    ${data.base.itemsPerSec.toFixed(2)} items/s = ${data.base.itemsPerMin.toFixed(1)} items/min`)
    lines.push(`    Inserters required: ${data.base.insertersRequired}`)
    lines.push(`  Max research:`)
    lines.push(`    ${data.maxResearch.itemsPerSec.toFixed(2)} items/s = ${data.maxResearch.itemsPerMin.toFixed(1)} items/min`)
    lines.push(`    Inserters required: ${data.maxResearch.insertersRequired}`)
    lines.push('')
  }
  
  lines.push('═══════════════════════════════════════════════════════════════')
  
  return lines.join('\n')
}

async function main() {
  const argv = process.argv.slice(2)
  
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log(`
Usage: node --loader ts-node/esm scripts/rate-calculator.ts <blueprint.json> [options]

Calculate throughput requirements based on blueprint furnaces.

Arguments:
  blueprint.json    Path to blueprint JSON file

Options:
  --belt-type TYPE       Belt type: transport-belt (default), fast-transport-belt, express-transport-belt
  --inserter-type TYPE   Inserter type: inserter (default), fast-inserter, stack-inserter, etc.
  --research             Show max research rates (default: base only)
  --json                 Output as JSON instead of formatted text

Examples:
  rate-calculator blueprints/smelting/smelting.json
  rate-calculator blueprints/smelting/smelting.json --belt-type fast-transport-belt
  rate-calculator blueprints/smelting/smelting.json --inserter-type fast-inserter --research
`)
    process.exit(0)
  }
  
  const blueprintFile = argv[0]
  if (!blueprintFile) {
    console.error('Error: Missing blueprint.json argument')
    process.exit(1)
  }
  
  let beltType = 'transport-belt'
  let inserterType = 'inserter'
  let showResearch = false
  let asJson = false
  
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--belt-type') { 
      const nextArg = argv[++i]
      if (nextArg) beltType = nextArg
      continue
    }
    if (arg === '--inserter-type') { 
      const nextArg = argv[++i]
      if (nextArg) inserterType = nextArg
      continue
    }
    if (arg === '--research') { showResearch = true; continue }
    if (arg === '--json') { asJson = true; continue }
  }
  
  // Verify belt and inserter types exist
  if (!BELT_SPEEDS[beltType]) {
    console.error(`Error: Unknown belt type "${beltType}"`)
    console.error(`Available: ${Object.keys(BELT_SPEEDS).join(', ')}`)
    process.exit(1)
  }
  
  if (!INSERTER_SPECS[inserterType]) {
    console.error(`Error: Unknown inserter type "${inserterType}"`)
    console.error(`Available: ${Object.keys(INSERTER_SPECS).join(', ')}`)
    process.exit(1)
  }
  
  const beltSpeed = BELT_SPEEDS[beltType]!
  const inserterSpec = INSERTER_SPECS[inserterType]!
  
  // Read blueprint
  let entities: any[] = []
  try {
    const raw = await fs.readFile(path.resolve(blueprintFile), 'utf8')
    const json = JSON.parse(raw)
    const bp = json.blueprint ?? json
    entities = bp.entities ?? []
  } catch (e) {
    console.error(`Error reading blueprint: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }
  
  if (entities.length === 0) {
    console.error('Error: No entities found in blueprint')
    process.exit(1)
  }
  
  // Count furnaces
  const furnaceNames = new Set(['stone-furnace', 'steel-furnace', 'electric-furnace'])
  const furnaceCount = entities.filter((e: any) => furnaceNames.has(e.name)).length
  
  if (furnaceCount === 0) {
    console.error('Error: No furnaces found in blueprint')
    process.exit(1)
  }
  
  // Calculate rates
  const furnaceRate = getFurnaceRate()
  const totalProductionRate = furnaceCount * furnaceRate // items/minute output
  const totalEnergyConsumption = furnaceCount * FURNACE_SPECS.energyConsumptionJoulesPerSecond // joules/second
  
  // Calculate fuel requirements
  const coalConsumption = (totalEnergyConsumption * 60) / (FUEL_ENERGY['coal'] ?? 4_000_000) // items/minute
  const solidFuelConsumption = (totalEnergyConsumption * 60) / (FUEL_ENERGY['solid-fuel'] ?? 12_000_000) // items/minute
  
  // Get belt and inserter speeds
  const beltItemsPerMin = beltSpeed * 60
  const beltLanesRequired = Math.ceil(totalProductionRate / beltItemsPerMin)
  
  // Get inserter speed
  const ticksPerSecond = 60
  const swingTimeSeconds = inserterSpec.swingTicks / ticksPerSecond
  
  const baseItemsPerSec = inserterSpec.baseStack / swingTimeSeconds
  const baseItemsPerMin = baseItemsPerSec * 60
  const baseInsertorsRequired = Math.ceil(totalProductionRate / baseItemsPerMin)
  
  let maxItemsPerMin = 0
  let maxInsertorsRequired = 0
  if (showResearch) {
    const maxItemsPerSec = inserterSpec.maxResearchStack / swingTimeSeconds
    maxItemsPerMin = maxItemsPerSec * 60
    maxInsertorsRequired = Math.ceil(totalProductionRate / maxItemsPerMin)
  }
  
  // Format output
  if (asJson) {
    // Build items array with machines first, then inputs and outputs
    const items = [
      {
        type: 'machine',
        name: 'stone-furnace',
        count: furnaceCount,
        recipe: 'smelting',
      },
      {
        type: 'input',
        name: 'iron-ore',
        rateItemsPerSec: totalProductionRate / 60,
        rateItemsPerMin: totalProductionRate,
        belts: beltLanesRequired,
        inserters: Math.ceil(totalProductionRate / baseItemsPerMin),
      },
      {
        type: 'output',
        name: 'iron-plate',
        rateItemsPerSec: totalProductionRate / 60,
        rateItemsPerMin: totalProductionRate,
        belts: beltLanesRequired,
        inserters: Math.ceil(totalProductionRate / baseItemsPerMin),
      },
      {
        type: 'fuel',
        name: 'coal',
        rateItemsPerSec: coalConsumption / 60,
        rateItemsPerMin: coalConsumption,
        belts: Math.ceil(coalConsumption / (beltSpeed * 60)),
        inserters: Math.ceil(coalConsumption / baseItemsPerMin),
      },
    ]

    if (showResearch) {
      const maxItemsPerSec = inserterSpec.maxResearchStack / swingTimeSeconds
      const maxItemsPerMin = maxItemsPerSec * 60
      
      items.forEach((item: any) => {
        if (item.type === 'input' || item.type === 'output' || item.type === 'fuel') {
          const rate = item.type === 'fuel' ? coalConsumption : totalProductionRate
          item.inserters_maxResearch = Math.ceil(rate / maxItemsPerMin)
        }
      })
    }

    const output = {
      blueprint: blueprintFile,
      items,
    }
    console.log(JSON.stringify(output, null, 2))
  } else {
    const lines = [
      '═══════════════════════════════════════════════════════════════',
      'FACTORIO RATE CALCULATOR',
      '═══════════════════════════════════════════════════════════════',
      '',
      `Blueprint: ${blueprintFile}`,
      `Furnaces: ${furnaceCount}`,
      '',
      '───────────────────────────────────────────────────────────────',
      'THROUGHPUT',
      '───────────────────────────────────────────────────────────────',
      `Input (ore):        ${totalProductionRate.toFixed(1)} items/min`,
      `Output (plates):    ${totalProductionRate.toFixed(1)} items/min`,
      `Coal consumed:      ${coalConsumption.toFixed(1)} items/min`,
      `Solid fuel alt:     ${solidFuelConsumption.toFixed(1)} items/min`,
      '',
      '───────────────────────────────────────────────────────────────',
      `BELT TRANSFER (${beltType})`,
      '───────────────────────────────────────────────────────────────',
      `Speed: ${beltSpeed} items/s = ${(beltSpeed * 60).toFixed(1)} items/min`,
      `Lanes required: ${beltLanesRequired}`,
      '',
      '───────────────────────────────────────────────────────────────',
      `COAL TRANSFER (${inserterType})`,
      '───────────────────────────────────────────────────────────────',
      `Speed: ${baseItemsPerSec.toFixed(2)} items/s = ${baseItemsPerMin.toFixed(1)} items/min`,
      `Inserters required: ${baseInsertorsRequired}`,
    ]
    
    if (showResearch) {
      lines.push('')
      lines.push(`With max research:`)
      lines.push(`  Speed: ${(inserterSpec.maxResearchStack / swingTimeSeconds).toFixed(2)} items/s = ${maxItemsPerMin.toFixed(1)} items/min`)
      lines.push(`  Inserters required: ${maxInsertorsRequired}`)
    }
    
    lines.push('')
    lines.push('═══════════════════════════════════════════════════════════════')
    
    console.log(lines.join('\n'))
  }
}

main().catch((e) => {
  console.error('Error:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
