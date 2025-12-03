import { promises as fs } from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'

async function findGoldenFiles(root: string) {
  const results: string[] = []
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(root, e.name)
    if (e.isDirectory()) {
      const child = await findGoldenFiles(p)
      results.push(...child)
    } else if (e.isFile() && e.name.startsWith('golden_') && e.name.endsWith('.ascii')) {
      results.push(p)
    }
  }
  return results
}

function runAscii(jsonPath: string, outPath: string) {
  // Include --no-warnings so spawned node processes don't print loader/deprecation warnings.
  const res = spawnSync('node', ['--no-warnings', '--loader', 'ts-node/esm', path.join('scripts', 'blueprint-ascii.ts'), '--quiet', '--out', outPath, jsonPath], { stdio: 'inherit' })
  if (res.error) throw res.error
  return res.status ?? 0
}

async function findMatchingJson(goldenPath: string) {
  const dir = path.dirname(goldenPath)
  const goldenName = path.basename(goldenPath, '.ascii') // golden_power1
  const baseHint = goldenName.replace(/^golden_/, '')
  const files = await fs.readdir(dir)
  const jsons = files.filter((f) => f.endsWith('.json'))
  if (jsons.length === 0) return null
  // try exact match
  for (const j of jsons) {
    if (path.basename(j, '.json') === baseHint) return path.join(dir, j)
  }
  // try contains
  for (const j of jsons) {
    if (baseHint.includes(path.basename(j, '.json')) || path.basename(j, '.json').includes(baseHint)) return path.join(dir, j)
  }
  // fallback to first json
  return path.join(dir, jsons[0]!)
}

async function main() {
  const repoRoot = path.resolve('blueprints')
  const goldens = await findGoldenFiles(repoRoot)
  if (goldens.length === 0) {
    console.log('No golden files found under blueprints/. Nothing to test.')
    return
  }

  let failed = 0
  for (const g of goldens) {
    const jsonPath = await findMatchingJson(g)
    if (!jsonPath) {
      console.warn(`No json file found for golden ${g}, skipping`)
      continue
    }

    const tmp = path.join('/tmp', `current_${path.basename(g)}`)
    const status = runAscii(jsonPath, tmp)
    if (status !== 0) {
      console.error(`Renderer failed for ${jsonPath}`)
      failed++
      continue
    }

    const [goldenData, currentData] = await Promise.all([fs.readFile(g, 'utf8'), fs.readFile(tmp, 'utf8')])
    if (goldenData !== currentData) {
      console.error(`Mismatch for ${g} (generated from ${jsonPath})`)
      // try to show a unified diff if `diff` is available
      const diff = spawnSync('diff', ['-u', g, tmp], { encoding: 'utf8' })
      if (diff.status === 0) {
        console.error('diff reports no difference but contents differ')
      } else if (diff.stdout || diff.stderr) {
        console.error(diff.stdout || diff.stderr)
      } else {
        console.error('Files differ but no diff output available')
      }
      failed++
    } else {
      console.log(`OK: ${g}`)
    }
  }

  if (failed > 0) {
    console.error(`${failed} golden(s) did not match`)
    process.exit(1)
  }
  console.log('All golden files match')
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
