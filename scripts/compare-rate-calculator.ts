/**
 * Compare actual rate calculator output with expected values
 */

import { promises as fs } from 'fs'
import * as child_process from 'child_process'
import * as util from 'util'

const exec = util.promisify(child_process.exec)

interface Item {
  type: string
  name: string
  rateItemsPerMin?: number
  inserters?: number
  count?: number
  recipe?: string
}

interface ComparisonResult {
  item: Item
  expected: Item
  insertersDiff: number
  ratesDiff: number
  match: boolean
}

async function runRateCalculator(blueprintPath: string): Promise<any> {
  const { stdout } = await exec(
    `node --no-warnings --loader ts-node/esm scripts/rate-calculator.ts ${blueprintPath} --json`,
    { cwd: process.cwd() }
  )
  return JSON.parse(stdout)
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('RATE CALCULATOR - ACTUAL VS EXPECTED')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // Load expected values
  const expectedRaw = await fs.readFile(
    'blueprints/intermediates/intermediates.expected.json',
    'utf8'
  )
  const expected = JSON.parse(expectedRaw)

  // Get actual output
  console.log('Running rate calculator...')
  const actual = await runRateCalculator('blueprints/intermediates/intermediates.json')
  console.log('✓ Completed')
  console.log('')

  // Compare inputs and outputs
  console.log('───────────────────────────────────────────────────────────────')
  console.log('INPUT/OUTPUT COMPARISON')
  console.log('───────────────────────────────────────────────────────────────')
  console.log('')

  const results: ComparisonResult[] = []

  for (const expectedItem of expected.items) {
    if (expectedItem.type !== 'input' && expectedItem.type !== 'output') continue

    // Find matching actual item
    const actualItems = actual.items.filter(
      (item: Item) => item.type === expectedItem.type && item.name === expectedItem.name
    )

    if (actualItems.length === 0) {
      console.log(
        `✗ MISSING: ${expectedItem.type} "${expectedItem.name}" (expected ${expectedItem.inserters} inserters)`
      )
      continue
    }

    // For inputs like iron-plate that appear multiple times, sum them up
    let totalInserters = 0
    let totalRate = 0
    for (const item of actualItems) {
      totalInserters += item.inserters ?? 0
      totalRate += item.rateItemsPerMin ?? 0
    }

    if (actualItems.length > 1 && expectedItem.type === 'input') {
      // Sum the actual values for comparison
      const insertersDiff = totalInserters - (expectedItem.inserters ?? 0)
      const ratesDiff = totalRate - (expectedItem.rateItemsPerMin ?? 0)
      const match = Math.abs(insertersDiff) < 0.05 && Math.abs(ratesDiff) < 0.5

      results.push({
        item: { ...expectedItem, inserters: totalInserters, rateItemsPerMin: totalRate },
        expected: expectedItem,
        insertersDiff,
        ratesDiff,
        match,
      })

      const status = match ? '✓' : '✗'
      console.log(`${status} ${expectedItem.type.toUpperCase()} "${expectedItem.name}" (${actualItems.length} instances)`)
      console.log(
        `   Inserters: ${totalInserters.toFixed(2)} (expected ${expectedItem.inserters?.toFixed(2)}, diff: ${insertersDiff > 0 ? '+' : ''}${insertersDiff.toFixed(2)})`
      )
      console.log(
        `   Rate: ${totalRate.toFixed(1)} items/min (expected ${expectedItem.rateItemsPerMin}, diff: ${ratesDiff > 0 ? '+' : ''}${ratesDiff.toFixed(1)})`
      )
      console.log('')
      continue
    }

    const actualItem = actualItems[0]
    const insertersDiff = (actualItem.inserters ?? 0) - (expectedItem.inserters ?? 0)
    const ratesDiff = (actualItem.rateItemsPerMin ?? 0) - (expectedItem.rateItemsPerMin ?? 0)
    const match =
      Math.abs(insertersDiff) < 0.05 && Math.abs(ratesDiff) < 0.5

    results.push({
      item: actualItem,
      expected: expectedItem,
      insertersDiff,
      ratesDiff,
      match,
    })

    const status = match ? '✓' : '✗'
    console.log(`${status} ${expectedItem.type.toUpperCase()} "${expectedItem.name}"`)
    console.log(
      `   Inserters: ${actualItem.inserters?.toFixed(2)} (expected ${expectedItem.inserters?.toFixed(2)}, diff: ${insertersDiff > 0 ? '+' : ''}${insertersDiff.toFixed(2)})`
    )
    console.log(
      `   Rate: ${actualItem.rateItemsPerMin?.toFixed(1)} items/min (expected ${expectedItem.rateItemsPerMin}, diff: ${ratesDiff > 0 ? '+' : ''}${ratesDiff.toFixed(1)})`
    )
    console.log('')
  }

  // Summary
  console.log('───────────────────────────────────────────────────────────────')
  const matched = results.filter((r) => r.match).length
  const total = results.length
  console.log(`SUMMARY: ${matched}/${total} items match`)
  console.log('───────────────────────────────────────────────────────────────')
  console.log('')

  // Show full outputs for debugging
  console.log('ACTUAL OUTPUT:')
  console.log(JSON.stringify(actual, null, 2))
  console.log('')
  console.log('EXPECTED OUTPUT:')
  console.log(JSON.stringify(expected, null, 2))
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
