/**
 * Test suite for rate calculator
 * Validates the intermediates blueprint production rates match expected values
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import * as child_process from 'child_process'
import * as util from 'util'

const exec = util.promisify(child_process.exec)

interface RateCalculatorOutput {
  blueprint: string
  items: Array<{
    type: 'machine' | 'input' | 'output' | 'fuel'
    name: string
    rateItemsPerMin?: number
    inserters?: number
    belts?: number
  }>
}

interface ItemRequirement {
  name: string
  type: 'input' | 'output'
  expectedInserters: number
  tolerance: number
}

async function runRateCalculator(blueprintPath: string): Promise<RateCalculatorOutput> {
  try {
    const { stdout } = await exec(
      `node --no-warnings --loader ts-node/esm tools/rate-calculator/index.ts ${blueprintPath} --json`,
      { cwd: '/Users/olivermainey/Workspace/factorio-ai' }
    )
    return JSON.parse(stdout)
  } catch (e) {
    console.error('Failed to run rate calculator:', e)
    throw e
  }
}

function testItem(
  output: RateCalculatorOutput,
  itemName: string,
  itemType: string,
  expectedInserters: number,
  tolerance: number = 0.1
): { passed: boolean; actual: number; expected: number; message: string } {
  const items = output.items.filter(
    (item) => item.name === itemName && item.type === itemType
  )

  if (items.length === 0) {
    return {
      passed: false,
      actual: 0,
      expected: expectedInserters,
      message: `No items found for ${itemType} "${itemName}"`,
    }
  }

  if (items.length > 1) {
    return {
      passed: false,
      actual: 0,
      expected: expectedInserters,
      message: `Multiple items found for ${itemType} "${itemName}" (expected 1)`,
    }
  }

  const item = items[0]!
  const actual = item.inserters ?? 0
  const passed = Math.abs(actual - expectedInserters) <= tolerance

  return {
    passed,
    actual,
    expected: expectedInserters,
    message: `${itemType} "${itemName}": ${actual.toFixed(2)} (expected ${expectedInserters.toFixed(2)} ±${tolerance.toFixed(2)})`,
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('RATE CALCULATOR TEST SUITE - INTERMEDIATES BLUEPRINT')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  const blueprintPath = 'blueprints/intermediates/intermediates.json'

  // Run calculator
  console.log(`Running rate calculator on ${blueprintPath}...`)
  const output = await runRateCalculator(blueprintPath)
  console.log('✓ Rate calculator executed successfully')
  console.log('')

  // Define expected requirements based on Factorio in-game Rate Calculator
  const requirements: ItemRequirement[] = [
    // Input requirements
    { name: 'iron-plate', type: 'input', expectedInserters: 7.2, tolerance: 0.05 },
    { name: 'copper-plate', type: 'input', expectedInserters: 3.6, tolerance: 0.05 },
    // Output requirements
    { name: 'iron-gear-wheel', type: 'output', expectedInserters: 2.4, tolerance: 0.05 },
    { name: 'electronic-circuit', type: 'output', expectedInserters: 2.4, tolerance: 0.05 },
    // Copper cable special case: 7.2 inserters for both input and output
    { name: 'copper-cable', type: 'input', expectedInserters: 7.2, tolerance: 0.05 },
    { name: 'copper-cable', type: 'output', expectedInserters: 7.2, tolerance: 0.05 },
  ]

  // Run tests
  console.log('───────────────────────────────────────────────────────────────')
  console.log('TEST RESULTS')
  console.log('───────────────────────────────────────────────────────────────')
  console.log('')

  let passed = 0
  let failed = 0
  const results: string[] = []

  for (const req of requirements) {
    const result = testItem(output, req.name, req.type, req.expectedInserters, req.tolerance)
    results.push(`${result.passed ? '✓' : '✗'} ${result.message}`)
    if (result.passed) passed++
    else failed++
  }

  // Print results
  results.forEach((r) => console.log(r))
  console.log('')

  // Summary
  console.log('───────────────────────────────────────────────────────────────')
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${requirements.length} tests`)
  console.log('───────────────────────────────────────────────────────────────')

  if (failed > 0) {
    console.log('')
    console.log('FULL OUTPUT FOR DEBUGGING:')
    console.log(JSON.stringify(output, null, 2))
    process.exit(1)
  } else {
    console.log('')
    console.log('✓ All tests passed!')
    process.exit(0)
  }
}

runTests().catch((e) => {
  console.error('Test suite error:', e)
  process.exit(1)
})
