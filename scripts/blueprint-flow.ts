import { promises as fs } from 'fs'
import * as path from 'path'

type Entity = { name: string; position?: { x: number; y: number }; direction?: number }

// Default path to recipes DB (can be overridden with --recipes)
const DEFAULT_RECIPES = path.resolve('data', 'recipes.json')

type RecipesDB = {
  entity_speeds?: Record<string, number>
  recipes?: Record<string, { time: number }>
}

async function loadRecipes(file?: string): Promise<RecipesDB> {
  const p = file ? path.resolve(file) : DEFAULT_RECIPES
  try {
    const txt = await fs.readFile(p, 'utf8')
    return JSON.parse(txt) as RecipesDB
  } catch (e) {
    // if missing, return empty DB
    return {}
  }
}

async function readEntities(input: string): Promise<Entity[]> {
  const raw = await fs.readFile(path.resolve(input), 'utf8')
  const json = JSON.parse(raw)
  const bp = json.blueprint ?? json
  return bp.entities ?? []
}

function countEntities(entities: Entity[]) {
  const counts: Record<string, number> = {}
  for (const e of entities) counts[e.name] = (counts[e.name] ?? 0) + 1
  return counts
}

function computeThroughput(counts: Record<string, number>, recipeTimeSec: number, speeds: Record<string, number>) {
  const perEntity: Record<string, { count: number; speed: number; items_per_sec: number; items_per_min: number }> = {}
  let totalPerSec = 0
  for (const [ename, speed] of Object.entries(speeds)) {
    const count = counts[ename] ?? 0
    if (count <= 0) continue
    const itemsPerSec = (count * speed) / recipeTimeSec
    perEntity[ename] = { count, speed, items_per_sec: itemsPerSec, items_per_min: itemsPerSec * 60 }
    totalPerSec += itemsPerSec
  }
  return { perEntity, totalPerSec, totalPerMin: totalPerSec * 60 }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 1) {
    console.error('Usage: node --loader ts-node/esm scripts/blueprint-flow.ts <blueprint.json> [--recipe-name NAME] [--recipe-time SEC] [--out|-o FILE]')
    process.exit(2)
  }

  let input: string | undefined
  let outFile: string | undefined
  let recipeTime = 3.5 // default if nothing else provided
  let recipeName: string | undefined
  let recipesFile: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out' || a === '-o') { i++; outFile = argv[i]; continue }
    if (a === '--recipe-time') { i++; recipeTime = Number(argv[i]); continue }
    if (a === '--recipe-name') { i++; recipeName = argv[i]; continue }
    if (a === '--recipes') { i++; recipesFile = argv[i]; continue }
    if (!input) input = a
  }

  if (!input) {
    console.error('Missing blueprint json input')
    process.exit(2)
  }

  const entities = await readEntities(input)
  const counts = countEntities(entities)

  const db = await loadRecipes(recipesFile)
  const speeds = db.entity_speeds ?? {}

  // if recipe name provided and present in db, use its time
  if (recipeName && db.recipes) {
    const r = db.recipes[recipeName]
    if (r && typeof r.time === 'number') recipeTime = r.time
  }

  const throughput = computeThroughput(counts, recipeTime, speeds)

  const meta: any = {
    input_file: input,
    total_entities: entities.length,
    recipe: recipeName ?? 'unnamed',
  recipe_time_sec: recipeTime,
    throughput,
    counts,
  }

  const out = JSON.stringify(meta, null, 2)
  if (outFile) {
    await fs.writeFile(outFile, out, 'utf8')
    console.log(`Wrote flow metrics to ${outFile}`)
  } else {
    process.stdout.write(out + '\n')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
