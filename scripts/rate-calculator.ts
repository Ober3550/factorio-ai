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
  'burner-inserter': { baseStack: 1, maxResearchStack: 4, swingTicks: 80 },
  'inserter': { baseStack: 1, maxResearchStack: 4, swingTicks: 72 },
  'long-handed-inserter': { baseStack: 1, maxResearchStack: 4, swingTicks: 55 },
  'fast-inserter': { baseStack: 1, maxResearchStack: 4, swingTicks: 26 },
  'bulk-inserter': { baseStack: 2, maxResearchStack: 12, swingTicks: 26 },
  'stack-inserter': { baseStack: 6, maxResearchStack: 16, swingTicks: 26 },
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
 * Recipe specifications: inputs, outputs, and crafting time in seconds
 * Assembly machine-1 has a crafting speed of 0.5 (50%)
 * Assembly machine-2 has a crafting speed of 0.75 (75%)
 * Assembly machine-3 has a crafting speed of 1.25 (125%)
 */
const RECIPE_SPECS: Record<string, { inputs: Record<string, number>; outputs: Record<string, number>; craftTimeSeconds: number }> = {
  'copper-cable': {
    inputs: { 'copper-plate': 1 },
    outputs: { 'copper-cable': 2 },
    craftTimeSeconds: 0.5,
  },
  'electronic-circuit': {
    inputs: { 'iron-plate': 1, 'copper-cable': 3 },
    outputs: { 'electronic-circuit': 1 },
    craftTimeSeconds: 0.5,
  },
  'iron-gear-wheel': {
    inputs: { 'iron-plate': 2 },
    outputs: { 'iron-gear-wheel': 1 },
    craftTimeSeconds: 0.5,
  },
  'automation-science-pack': {
    inputs: { 'copper-plate': 1, 'iron-gear-wheel': 1 },
    outputs: { 'automation-science-pack': 1 },
    craftTimeSeconds: 5,
  },
  'logistic-science-pack': {
    inputs: { 'transport-belt': 1, 'inserter': 1 },
    outputs: { 'logistic-science-pack': 1 },
    craftTimeSeconds: 5,
  },
  'transport-belt': {
    inputs: { 'iron-plate': 1, 'iron-gear-wheel': 1 },
    outputs: { 'transport-belt': 1 },
    craftTimeSeconds: 0.5,
  },
  'inserter': {
    inputs: { 'iron-plate': 1, 'iron-gear-wheel': 1, 'copper-cable': 1 },
    outputs: { 'inserter': 1 },
    craftTimeSeconds: 0.5,
  },
}

/**
 * Assembly machine crafting speeds
 */
const MACHINE_SPEEDS: Record<string, number> = {
  'assembling-machine-1': 0.5,
  'assembling-machine-2': 0.75,
  'assembling-machine-3': 1.25,
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
  
  // Count assembly machines by recipe
  const assemblyNames = new Set(['assembling-machine-1', 'assembling-machine-2', 'assembling-machine-3'])
  const assemblyMachines = entities.filter((e: any) => assemblyNames.has(e.name) && e.recipe)
  
  // Group assembly machines by recipe
  const recipeGroups: Record<string, any[]> = {}
  for (const machine of assemblyMachines) {
    const recipe = machine.recipe || 'unknown'
    if (!recipeGroups[recipe]) recipeGroups[recipe] = []
    recipeGroups[recipe].push(machine)
  }
  
  if (furnaceCount === 0 && assemblyMachines.length === 0) {
    console.error('Error: No furnaces or assembly machines found in blueprint')
    process.exit(1)
  }
  
  // If we have assembly machines, analyze them
  if (assemblyMachines.length > 0) {
    // Get inserter speed first
    const ticksPerSecond = 60
    const swingTimeSeconds = inserterSpec.swingTicks / ticksPerSecond
    const baseItemsPerSec = inserterSpec.baseStack / swingTimeSeconds
    const baseItemsPerMin = baseItemsPerSec * 60
    
    // Build items array with machines first, then inputs and outputs
    const items: any[] = []
    
    // Check for unknown recipes and report them
    const unknownRecipes = Object.keys(recipeGroups).filter(r => !RECIPE_SPECS[r])
    if (unknownRecipes.length > 0) {
      console.error('ERROR: The following recipes are not recognized by the rate calculator:')
      unknownRecipes.forEach(recipe => {
        const machines = recipeGroups[recipe]
        if (machines) {
          const machineCount = machines.length
          const machineName = machines[0].name
          console.error(`  - "${recipe}" (${machineCount}x ${machineName})`)
        }
      })
      console.error('')
      console.error('Please add recipe specifications to RECIPE_SPECS in rate-calculator.ts')
      console.error('Each recipe must define: inputs, outputs, and craftTimeSeconds')
      process.exit(1)
    }
    
    // Add all recipe groups as machine entries
    for (const [recipe, machines] of Object.entries(recipeGroups)) {
      items.push({
        type: 'machine',
        name: machines[0].name, // e.g., assembling-machine-1
        recipe,
        count: machines.length,
      })
    }
    
    // Add input/output/fuel items based on recipes
    // For now, show rates based on recipe crafting time
    for (const [recipe, machines] of Object.entries(recipeGroups)) {
      const recipeSpec = RECIPE_SPECS[recipe]
      if (!recipeSpec) continue
      
      const craftTimeSeconds = recipeSpec.craftTimeSeconds
      const machineCount = machines.length
      const machineName = machines[0].name
      const machineSpeed = MACHINE_SPEEDS[machineName] || 0.5
      
      // Actual craft time = base craft time / crafting speed
      // Each machine produces outputs per actual craft time
      // Total production rate: (machineCount * outputs) / actualCraftTime items per second
      
      for (const [outputItem, outputCount] of Object.entries(recipeSpec.outputs)) {
        // Actual craft time based on machine speed
        const actualCraftTimeSeconds = craftTimeSeconds / machineSpeed
        const totalProductionPerSec = (machineCount * outputCount) / actualCraftTimeSeconds
        const totalProductionPerMin = totalProductionPerSec * 60
        
        // Add output item (belt/inserter counts as decimals rounded to 2dp)
        items.push({
          type: 'output',
          name: outputItem,
          rateItemsPerSec: totalProductionPerSec,
          rateItemsPerMin: totalProductionPerMin,
          belts: Number((totalProductionPerMin / (beltSpeed * 60)).toFixed(2)),
          inserters: Number((totalProductionPerMin / baseItemsPerMin).toFixed(2)),
        })
      }
      
      // Add input items
      for (const [inputItem, inputCount] of Object.entries(recipeSpec.inputs)) {
        const actualCraftTimeSeconds = craftTimeSeconds / machineSpeed
        const totalInputPerSec = (machineCount * inputCount) / actualCraftTimeSeconds
        const totalInputPerMin = totalInputPerSec * 60
        
        items.push({
          type: 'input',
          name: inputItem,
          rateItemsPerSec: totalInputPerSec,
          rateItemsPerMin: totalInputPerMin,
          belts: Number((totalInputPerMin / (beltSpeed * 60)).toFixed(2)),
          inserters: Number((totalInputPerMin / baseItemsPerMin).toFixed(2)),
        })
      }
    }
    
    if (showResearch) {
      const maxItemsPerSec = inserterSpec.maxResearchStack / swingTimeSeconds
      const maxItemsPerMin = maxItemsPerSec * 60
      
      items.forEach((item: any) => {
        if (item.type === 'input' || item.type === 'output') {
          item.inserters_maxResearch = Number((item.rateItemsPerMin / maxItemsPerMin).toFixed(2))
        }
      })
    }
    
    const output = {
      blueprint: blueprintFile,
      items,
    }
    
    if (asJson) {
      console.log(JSON.stringify(output, null, 2))
    } else {
      const lines = [
        '═══════════════════════════════════════════════════════════════',
        'FACTORIO RATE CALCULATOR',
        '═══════════════════════════════════════════════════════════════',
        '',
        `Blueprint: ${blueprintFile}`,
        '',
      ]
      
      // Add machines section
      lines.push('───────────────────────────────────────────────────────────────')
      lines.push('MACHINES')
      lines.push('───────────────────────────────────────────────────────────────')
      for (const [recipe, machines] of Object.entries(recipeGroups)) {
        lines.push(`${recipe}: ${machines.length} ${machines[0].name}`)
      }
      
      // Add recipes section
      lines.push('')
      lines.push('───────────────────────────────────────────────────────────────')
      lines.push('RECIPES')
      lines.push('───────────────────────────────────────────────────────────────')
      for (const [recipe, machines] of Object.entries(recipeGroups)) {
        const recipeSpec = RECIPE_SPECS[recipe]
        if (!recipeSpec) continue
        
        const machineName = machines[0].name
        const machineSpeed = MACHINE_SPEEDS[machineName] || 0.5
        const actualCraftTimeSeconds = recipeSpec.craftTimeSeconds / machineSpeed
        const machineCount = machines.length
        
        // Show output rates for each output item
        const outputs = Object.entries(recipeSpec.outputs)
          .map(([item, count]) => {
            const perMin = (machineCount * count / actualCraftTimeSeconds) * 60
            return `${perMin.toFixed(2)} ${item}`
          })
          .join(', ')
        
        // Show input rates for each input item
        const inputs = Object.entries(recipeSpec.inputs)
          .map(([item, count]) => {
            const perMin = (machineCount * count / actualCraftTimeSeconds) * 60
            return `${perMin.toFixed(2)} ${item}`
          })
          .join(', ')
        
        lines.push(`${recipe} (${machineCount} × ${machineName} @ ${(machineSpeed * 100).toFixed(0)}%):`)
        lines.push(`  Outputs: ${outputs}`)
        lines.push(`  Inputs: ${inputs}`)
      }
      
      lines.push('')
      lines.push('═══════════════════════════════════════════════════════════════')
      
      console.log(lines.join('\n'))
    }
    return
  }
  
  // Handle furnaces
  const furnaceRate = getFurnaceRate()
  const totalProductionRate = furnaceCount * furnaceRate // items/minute output
  const totalEnergyConsumption = furnaceCount * FURNACE_SPECS.energyConsumptionJoulesPerSecond // joules/second
  
  // Calculate fuel requirements
  const coalConsumption = (totalEnergyConsumption * 60) / (FUEL_ENERGY['coal'] ?? 4_000_000) // items/minute
  const solidFuelConsumption = (totalEnergyConsumption * 60) / (FUEL_ENERGY['solid-fuel'] ?? 12_000_000) // items/minute
  
  // Get belt and inserter speeds
  const beltItemsPerMin = beltSpeed * 60
  const beltLanesRequired = Number((totalProductionRate / beltItemsPerMin).toFixed(2))
  
  // Get inserter speed
  const ticksPerSecond = 60
  const swingTimeSeconds = inserterSpec.swingTicks / ticksPerSecond
  
  const baseItemsPerSec = inserterSpec.baseStack / swingTimeSeconds
  const baseItemsPerMin = baseItemsPerSec * 60
  const baseInsertorsRequired = Number((totalProductionRate / baseItemsPerMin).toFixed(2))
  
  let maxItemsPerMin = 0
  let maxInsertorsRequired = 0
  if (showResearch) {
    const maxItemsPerSec = inserterSpec.maxResearchStack / swingTimeSeconds
  maxItemsPerMin = maxItemsPerSec * 60
  maxInsertorsRequired = Number((totalProductionRate / maxItemsPerMin).toFixed(2))
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
        inserters: Number((totalProductionRate / baseItemsPerMin).toFixed(2)),
      },
      {
        type: 'output',
        name: 'iron-plate',
        rateItemsPerSec: totalProductionRate / 60,
        rateItemsPerMin: totalProductionRate,
        belts: beltLanesRequired,
        inserters: Number((totalProductionRate / baseItemsPerMin).toFixed(2)),
      },
      {
        type: 'fuel',
        name: 'coal',
        rateItemsPerSec: coalConsumption / 60,
        rateItemsPerMin: coalConsumption,
        belts: Number((coalConsumption / (beltSpeed * 60)).toFixed(2)),
        inserters: Number((coalConsumption / baseItemsPerMin).toFixed(2)),
      },
    ]

    if (showResearch) {
      const maxItemsPerSec = inserterSpec.maxResearchStack / swingTimeSeconds
      const maxItemsPerMin = maxItemsPerSec * 60
      
      items.forEach((item: any) => {
        if (item.type === 'input' || item.type === 'output' || item.type === 'fuel') {
          const rate = item.type === 'fuel' ? coalConsumption : totalProductionRate
          item.inserters_maxResearch = Number((rate / maxItemsPerMin).toFixed(2))
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
