#!/usr/bin/env node
import type { CalculatorConfig } from '../src/models/calculator-config.js'
import { validateCalculatorConfig, buildCalculatorUrl } from '../src/models/calculator-config.js'
import type { ProductionRequirement } from '../src/models/production-requirement.js'
import { getCacheKey } from '../src/models/production-requirement.js'
import { SeleniumCalculatorService } from '../src/services/selenium-calculator.js'
import { CacheService } from '../src/services/cache-service.js'
import { writeJsonFile } from '../src/lib/file-utils.js'

// Simple argument parser (avoiding parseArgs compatibility issues)
function parseArguments() {
  const args = process.argv.slice(2)
  const values: Record<string, string | boolean | string[] | undefined> = {
    item: [],
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
    rate: undefined,
    output: undefined
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg && arg.startsWith('--')) {
      const key = arg.slice(2)
      if (key === 'no-cache' || key === 'clear-cache' || key === 'json' || key === 'quiet') {
        values[key] = true
      } else if (key === 'item') {
        // Collect multiple --item arguments
        if (i + 1 < args.length) {
          const nextArg = args[i + 1]
          if (nextArg && !nextArg.startsWith('--')) {
            if (Array.isArray(values.item)) {
              values.item.push(nextArg)
            }
            i++
          }
        }
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1]
        if (nextArg && !nextArg.startsWith('--')) {
          values[key] = nextArg
          i++
        }
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
  // Validate required arguments
  const items = Array.isArray(values.item) ? values.item : []
  if (items.length === 0 || !values.rate) {
    console.error('Error: --item (one or more) and --rate are required')
    console.error('Usage: calculate-requirements --item <item-id> [--item <item-id>...] --rate <number> [options]')
    process.exit(1)
  }

  const rate = parseFloat(values.rate as string)
  if (isNaN(rate) || rate <= 0) {
    console.error('Error: --rate must be a positive number')
    process.exit(1)
  }

  // Build calculator config with all items
  const config: CalculatorConfig = {
    items: items.map(name => ({ name, rate })),
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

  // Build calculator URL
  const calculatorUrl = buildCalculatorUrl(config)
  const cacheKey = getCacheKey(calculatorUrl)

  // Initialize services
  const cacheService = new CacheService()
  const calculatorService = new SeleniumCalculatorService({ headless: true })

  try {
    // Handle clear-cache flag
    if (values['clear-cache']) {
      if (!values.quiet) {
        console.error('Clearing cache entry...')
      }
      await cacheService.delete(cacheKey)
    }

    let requirement: ProductionRequirement | null = null

    // Check cache unless --no-cache
    if (!values['no-cache']) {
      requirement = await cacheService.get(cacheKey)
      if (requirement && !values.quiet) {
        console.error(`Cache hit: ${cacheKey}`)
      }
    }

    // Query calculator if not cached
    if (!requirement) {
      if (!values.quiet) {
        console.error('Querying Kirk McDonald calculator via Selenium...')
        console.error(`URL: ${calculatorUrl}`)
      }

      requirement = await calculatorService.queryCalculator(
        calculatorUrl,
        items.join(', '),
        rate,
        config.rateUnit,
        config.version
      )

      // Cache the result
      await cacheService.set(cacheKey, calculatorUrl, requirement)

      if (!values.quiet) {
        console.error('Calculator query complete. Result cached.')
      }
    }

    // Output result
    if (values.output && typeof values.output === 'string') {
      await writeJsonFile(values.output, requirement)
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
