import { promises as fs } from 'fs'
import * as path from 'path'

type Entity = { name: string; position?: { x: number; y: number }; direction?: number }

function summarize(entities: Entity[]) {
  const counts: Record<string, number> = {}
  for (const e of entities) {
    counts[e.name] = (counts[e.name] ?? 0) + 1
  }

  const furnaces = ['stone-furnace', 'steel-furnace', 'electric-furnace']
  const assemblers = ['assembling-machine-1', 'assembling-machine-2', 'assembling-machine-3']

  const meta: any = { total_entities: entities.length }

  if ((counts['boiler'] ?? 0) > 0) meta.boilers = counts['boiler']
  if ((counts['steam-engine'] ?? 0) > 0) meta.steam_engines = counts['steam-engine']

  const totalFurnaces = furnaces.reduce((s, k) => s + (counts[k] ?? 0), 0)
  if (totalFurnaces > 0) {
    meta.furnaces = {}
    if ((counts['stone-furnace'] ?? 0) > 0) meta.furnaces.stone = counts['stone-furnace']
    if ((counts['steel-furnace'] ?? 0) > 0) meta.furnaces.steel = counts['steel-furnace']
    if ((counts['electric-furnace'] ?? 0) > 0) meta.furnaces.electric = counts['electric-furnace']
    meta.furnaces.total = totalFurnaces
  }

  const totalAssemblers = assemblers.reduce((s, k) => s + (counts[k] ?? 0), 0)
  if (totalAssemblers > 0) {
    meta.assemblers = {}
    for (const k of assemblers) if ((counts[k] ?? 0) > 0) meta.assemblers[k] = counts[k]
    meta.assemblers.total = totalAssemblers
  }

  if ((counts['inserter'] ?? 0) > 0) meta.inserters = counts['inserter']
  if ((counts['transport-belt'] ?? 0) > 0) meta.belts = counts['transport-belt']
  if ((counts['offshore-pump'] ?? 0) > 0) meta.pumps = counts['offshore-pump']

  // collect other counts that are not in the basic list
  const known = new Set([
    'boiler',
    'steam-engine',
    'stone-furnace',
    'steel-furnace',
    'electric-furnace',
    'assembling-machine-1',
    'assembling-machine-2',
    'assembling-machine-3',
    'inserter',
    'transport-belt',
    'offshore-pump',
  ])

  const others: Record<string, number> = {}
  for (const k of Object.keys(counts)) {
    if (!known.has(k)) others[k] = counts[k]!
  }
  if (Object.keys(others).length > 0) meta.other_counts = others

  return meta
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 1) {
    console.error('Usage: node --loader ts-node/esm tools/blueprint-metadata/index.ts <blueprint.json> [--out|-o <file>]')
    process.exit(2)
  }

  let input: string | undefined
  let outFile: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out' || a === '-o') {
      i++
      outFile = argv[i]
      continue
    }
    if (!input) input = a
  }

  if (!input) {
    console.error('Missing blueprint json input')
    process.exit(2)
  }

  const raw = await fs.readFile(path.resolve(input), 'utf8')
  const json = JSON.parse(raw)
  const bp = json.blueprint ?? json
  const entities: Entity[] = bp.entities ?? []

  const meta = summarize(entities)
  const out = JSON.stringify(meta, null, 2)
  if (outFile) {
    await fs.writeFile(outFile, out, 'utf8')
    console.log(`Wrote metadata to ${outFile}`)
  } else {
    process.stdout.write(out + '\n')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
