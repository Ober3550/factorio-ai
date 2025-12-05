import { promises as fs } from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'

interface TestCase {
  name: string
  args: string[]
  goldenFile: string
}

const testCases: TestCase[] = [
  { name: 'base (no transform)', args: [], goldenFile: 'blueprints/transformTests/test_z2.txt' },
  { name: 'horizontal flip', args: ['--flip-x'], goldenFile: 'blueprints/transformTests/test_h_flip_z2.txt' },
  { name: 'vertical flip', args: ['--flip-y'], goldenFile: 'blueprints/transformTests/test_v_flip_z2.txt' },
  { name: 'rotate 90° (1 step)', args: ['--rotate', '1'], goldenFile: 'blueprints/transformTests/test_1_r_z2.txt' },
  { name: 'rotate 180° (2 steps)', args: ['--rotate', '2'], goldenFile: 'blueprints/transformTests/test_2_r_z2.txt' },
  { name: 'rotate 270° (3 steps)', args: ['--rotate', '3'], goldenFile: 'blueprints/transformTests/test_3_r_z2.txt' },
]

function normalizeAscii(text: string): string {
  // Remove trailing whitespace from each line, strip leading/trailing blank lines
  return text
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .trim()
}

async function runTest(testCase: TestCase): Promise<boolean> {
  const inputJson = 'blueprints/transformTests/test.json'
  const tempOut = `blueprints/transformTests/test_${testCase.name.replace(/[^a-z0-9]/gi, '_')}.json`

  // Run transform-blueprint.ts
  const transformArgs = [
    '--no-warnings',
    '--loader', 'ts-node/esm',
    'scripts/transform-blueprint.ts',
    inputJson,
    '--strip-entity-numbers',
    '--out', tempOut,
    ...testCase.args,
  ]

  const p1 = spawnSync(process.execPath, transformArgs, { encoding: 'utf8', cwd: process.cwd() })
  if (p1.error) {
    console.error(`[FAIL] ${testCase.name}: transform failed:`, p1.error)
    return false
  }
  if (p1.status !== 0) {
    console.error(`[FAIL] ${testCase.name}: transform exited with code ${p1.status}`)
    console.error(p1.stderr)
    return false
  }

  // Run blueprint-ascii.ts with --zoom-2 --clean on the transformed output
  const renderArgs = [
    '--no-warnings',
    '--loader', 'ts-node/esm',
    'scripts/blueprint-ascii.ts',
    tempOut,
    '--zoom-2',
    '--clean',
  ]

  const p2 = spawnSync(process.execPath, renderArgs, { encoding: 'utf8', cwd: process.cwd() })
  if (p2.error) {
    console.error(`[FAIL] ${testCase.name}: render failed:`, p2.error)
    return false
  }
  if (p2.status !== 0) {
    console.error(`[FAIL] ${testCase.name}: render exited with code ${p2.status}`)
    console.error(p2.stderr)
    return false
  }

  const rendered = p2.stdout || ''

  const renderedNormalized = normalizeAscii(rendered)

  // Read golden file
  let golden: string
  try {
    golden = await fs.readFile(path.resolve(testCase.goldenFile), 'utf8')
    golden = normalizeAscii(golden)
  } catch (e) {
    console.error(`[FAIL] ${testCase.name}: could not read golden file ${testCase.goldenFile}`)
    return false
  }

  // Compare normalized versions
  if (renderedNormalized === golden) {
    console.log(`[PASS] ${testCase.name}`)
    return true
  } else {
    console.log(`[FAIL] ${testCase.name}`)
    console.log('  Expected:')
    golden.split('\n').forEach((line) => console.log(`    ${line}`))
    console.log('  Got:')
    renderedNormalized.split('\n').forEach((line) => console.log(`    ${line}`))
    return false
  }
}

async function main() {
  // First, decode test.bp to test.json if it doesn't exist
  const testJson = 'blueprints/transformTests/test.json'
  try {
    await fs.stat(testJson)
  } catch {
    console.log('Decoding test.bp to test.json...')
    const decodeArgs = [
      '--no-warnings',
      '--loader', 'ts-node/esm',
      'scripts/decode-blueprint.ts',
      'blueprints/transformTests/test.bp',
    ]
    const p = spawnSync(process.execPath, decodeArgs, { encoding: 'utf8', cwd: process.cwd() })
    if (p.status !== 0) {
      console.error('Failed to decode test.bp:', p.stderr)
      process.exit(1)
    }
  }

  console.log('\n=== Transform Blueprint Tests ===\n')

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    const ok = await runTest(testCase)
    if (ok) passed++
    else failed++
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
