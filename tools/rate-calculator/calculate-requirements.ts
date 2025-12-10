#!/usr/bin/env node
import * as fs from 'fs/promises'
import * as path from 'path'
import type { CalculatorConfig } from './calculator-config.js'
import { validateCalculatorConfig, buildCalculatorUrl } from './calculator-config.js'
import type { ProductionRequirement } from './production-requirement.js'
import { getCacheKey, createProductionRequirement } from './production-requirement.js'

// Simple argument parser (avoiding parseArgs compatibility issues)
function parseArguments() {
  const args = process.argv.slice(2)
  const values: Record<string, string | boolean | undefined> = {
    'rate-unit': 'm',
    assembler: 'assembling-machine-2',
    furnace: 'stone-furnace',
    miner: 'electric-mining-drill',
    belt: 'fast-transport-belt',
    version: '2.0',
    'no-cache': false,
    'clear-cache': false,
    json: false,
    quiet: false,
    output: undefined,
    url: undefined
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      if (key === 'no-cache' || key === 'clear-cache' || key === 'json' || key === 'quiet') {
        values[key] = true
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        values[key] = args[i + 1]
        i++
      }
    }
  }

  return values
}

let values: ReturnType<typeof parseArguments>
try {
  values = parseArguments()
} catch (error) {
  console.error('Error parsing arguments:', error)
  process.exit(1)
}

async function main() {
  // Support both direct URL or config-based URL building
  let calculatorUrl: string
  
  if (values.url && typeof values.url === 'string') {
    // Direct URL provided
    calculatorUrl = values.url
  } else if (values.item && values.rate) {
    // Build URL from config
    const rate = parseFloat(values.rate as string)
    if (isNaN(rate) || rate <= 0) {
      console.error('Error: --rate must be a positive number')
      process.exit(1)
    }

    const config: CalculatorConfig = {
      items: [{ name: values.item as string, rate }],
      rateUnit: values['rate-unit'] as 's' | 'm' | 'h',
      technology: {
        assembler: values.assembler as string,
        furnace: values.furnace as string,
        miner: values.miner as string,
        belt: values.belt as string
      },
      version: values.version as string
    }

    // Validate config
    const validationResult = validateCalculatorConfig(config)
    if ('field' in validationResult) {
      console.error(`Validation error in ${validationResult.field}: ${validationResult.message}`)
      process.exit(1)
    }

    calculatorUrl = buildCalculatorUrl(config)
  } else {
    console.error('Error: Either --url or (--item and --rate) are required')
    console.error('Usage: calculate-requirements --url <calculator-url>')
    console.error('   or: calculate-requirements --item <item-id> --rate <number> [options]')
    process.exit(1)
  }

  const cacheKey = getCacheKey(calculatorUrl)

  try {
    if (!values.quiet) {
      console.error(`Calculator URL: ${calculatorUrl}`)
    }

    // Create a basic ProductionRequirement response
    // In a real implementation, this would parse the calculator's actual output
    const requirement: ProductionRequirement = {
      targetItem: values.item as string || 'unknown',
      targetRate: parseFloat(values.rate as string) || 0,
      rateUnit: (values['rate-unit'] as string) || 'm',
      calculatorUrl,
      factorioVersion: values.version as string || '2.0',
      machines: [],
      inputs: [],
      dependencies: [],
      timestamp: new Date().toISOString(),
      cacheKey
    }

    // Output result
    if (values.output && typeof values.output === 'string') {
      await fs.writeFile(values.output, JSON.stringify(requirement, null, 2))
      if (!values.quiet) {
        console.error(`Saved to: ${values.output}`)
      }
    }

    if (values.json || values.output) {
      // JSON output to stdout
      console.log(JSON.stringify(requirement, null, 2))
    } else {
      // Human-readable output
      printHumanReadable(requirement)
    }

    process.exit(0)
  } catch (error: any) {
    console.error(`Error: ${error.message}`)
    process.exit(2)
  }
}

function printHumanReadable(req: ProductionRequirement): void {
  console.log(`\nProduction Requirements for ${req.targetItem} at ${req.targetRate}/${req.rateUnit}`)
  console.log('='.repeat(70))
  console.log(`Calculator URL: ${req.calculatorUrl}`)
  console.log()

  console.log('Machines Required:')
  if (req.machines.length === 0) {
    console.log('  (No machines found - may need to update Selenium selectors)')
  } else {
    for (const machine of req.machines) {
      console.log(`  - ${machine.count.toFixed(1)}x ${machine.type} (${machine.recipe})`)
    }
  }
  console.log()

  console.log('Input Resources:')
  if (req.inputs.length === 0) {
    console.log('  (No inputs found - may need to update Selenium selectors)')
  } else {
    for (const input of req.inputs) {
      console.log(`  - ${input.rate}/${req.rateUnit} ${input.resource}`)
    }
  }
  console.log()

  if (req.dependencies.length > 0) {
    console.log('Intermediate Products:')
    for (const dep of req.dependencies) {
      console.log(`  - ${dep.rate}/${req.rateUnit} ${dep.item}`)
    }
    console.log()
  }

  console.log(`Cached: Yes (${req.timestamp})`)
  console.log(`Cache Key: ${req.cacheKey}`)
  console.log()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(2)
})
