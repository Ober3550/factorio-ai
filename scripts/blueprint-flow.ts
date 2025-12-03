import { promises as fs } from 'fs'
import * as path from 'path'

type Entity = { name: string; position?: { x: number; y: number }; direction?: number }

// Default path to recipes DB (can be overridden with --recipes)
const DEFAULT_RECIPES = path.resolve('data', 'recipes.json')

type RecipesDB = {
  entity_speeds?: Record<string, number>
  recipes?: Record<string, { time: number }>
}

// extend DB with belt speeds (items per second per belt lane)
type ExtendedRecipesDB = RecipesDB & {
  belt_speeds?: Record<string, number>
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

function dirStepToVec(step: number) {
  switch (step & 3) {
    case 0: return { x: 0, y: -1 } // north
    case 1: return { x: 1, y: 0 } // east
    case 2: return { x: 0, y: 1 } // south
    default: return { x: -1, y: 0 } // west
  }
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
  const edb = db as ExtendedRecipesDB
  const speeds = edb.entity_speeds ?? {}
  const beltSpeeds = edb.belt_speeds ?? { 'transport-belt': 15, 'fast-transport-belt': 30, 'express-transport-belt': 45 }

  // if recipe name provided and present in db, use its time
  if (recipeName && db.recipes) {
    const r = db.recipes[recipeName]
    if (r && typeof r.time === 'number') recipeTime = r.time
  }

  const throughput = computeThroughput(counts, recipeTime, speeds)

    // belt analysis: group belt tiles into connected components (4-neighbor adjacency).
    const beltEntities = entities.filter((e: any) => beltSpeeds[e.name])
    const posKey = (x: number, y: number) => `${x},${y}`
    const beltMap = new Map<string, any>()
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const b of beltEntities) {
      const bx = Math.round(b.position?.x ?? 0)
      const by = Math.round(b.position?.y ?? 0)
      const key = posKey(bx, by)
      beltMap.set(key, { b, x: bx, y: by })
    const sp = beltSpeeds[b.name] ?? 0
      minX = Math.min(minX, bx)
      maxX = Math.max(maxX, bx)
      minY = Math.min(minY, by)
      maxY = Math.max(maxY, by)
    }

    // Union-find for components
    const parent = new Map<string, string>()
    function find(a: string): string {
      const p = parent.get(a) ?? a
      if (p === a) return a
      const r = find(p)
      parent.set(a, r)
      return r
    }
    function union(a: string, b: string) {
      const ra = find(a), rb = find(b)
      if (ra === rb) return
      parent.set(rb, ra)
    }

    for (const key of beltMap.keys()) parent.set(key, key)
    for (const { x, y } of beltMap.values()) {
      const k = posKey(x, y)
      const neigh = [posKey(x + 1, y), posKey(x - 1, y), posKey(x, y + 1), posKey(x, y - 1)]
      for (const nk of neigh) {
        if (beltMap.has(nk)) union(k, nk)
      }
    }

    const comps = new Map<string, { keys: string[]; items: Array<{name:string,x:number,y:number,d?:number}>; xs: number[]; ys: number[] }>()
    for (const key of beltMap.keys()) {
      const root = find(key)
      const info = comps.get(root) ?? { keys: [], items: [], xs: [], ys: [] }
      const item = beltMap.get(key)
      info.keys.push(key)
      info.items.push({ name: item.b.name, x: item.x, y: item.y, d: item.b.direction })
      info.xs.push(item.x)
      info.ys.push(item.y)
      comps.set(root, info)
    }

  // compute per-component capacity by counting parallel lanes (not summing tiles)
  const compList = Array.from(comps.entries()).map(([root, c], idx) => {
      // decide orientation: use direction info if available, otherwise compare span
      let sumDx = 0, sumDy = 0, dirCount = 0
      for (const it of c.items) {
        if (typeof it.d === 'number') {
          const step = Math.floor(it.d / 4) & 3
          const v = dirStepToVec(step)
          sumDx += v.x; sumDy += v.y; dirCount++
        }
      }
      const spanX = Math.max(...c.xs) - Math.min(...c.xs)
      const spanY = Math.max(...c.ys) - Math.min(...c.ys)
      let horizontal = true
      if (dirCount > 0) horizontal = Math.abs(sumDx) >= Math.abs(sumDy)
      else horizontal = spanX >= spanY

      const laneMap = new Map<number, number[]>()
      for (const it of c.items) {
        const laneKey = horizontal ? Math.round(it.y) : Math.round(it.x)
        const arr = laneMap.get(laneKey) ?? []
        arr.push(beltSpeeds[it.name] ?? (beltSpeeds['transport-belt'] || 15))
        laneMap.set(laneKey, arr)
      }

      // lane capacity = minimum segment speed in that lane (conservative)
      let compCap = 0
      for (const speedsArr of laneMap.values()) {
        const laneMin = Math.min(...speedsArr)
        compCap += laneMin
      }

      const cx = c.xs.reduce((s, v) => s + v, 0) / c.xs.length
      const cy = c.ys.reduce((s, v) => s + v, 0) / c.ys.length
      return { id: idx, root, size: c.keys.length, cap: compCap, cx, cy }
    })
    const maxComponentCapacity = compList.length ? Math.max(...compList.map(c => c.cap)) : 0
    // heuristics: determine module center
    const centerX = (isFinite(minX) && isFinite(maxX)) ? (minX + maxX) / 2 : 0

    // Detect inserter adjacency: map furnaces and inserters to positions and mark belt components
    const furnaceNames = new Set(['stone-furnace', 'steel-furnace', 'electric-furnace'])
    const furnaceMap = new Map<string, any>()
    for (const e of entities) {
      if (furnaceNames.has(e.name)) {
        const k = posKey(Math.round(e.position?.x ?? 0), Math.round(e.position?.y ?? 0))
        furnaceMap.set(k, e)
      }
    }

    const inserters = entities.filter((e: any) => e.name === 'inserter')
    const inputCompRoots = new Set<string>()
    const outputCompRoots = new Set<string>()
    for (const ins of inserters) {
      if (typeof ins.direction !== 'number') continue
      const step = Math.floor(ins.direction / 4) & 3
      const v = dirStepToVec(step)
      const ix = Math.round(ins.position?.x ?? 0)
      const iy = Math.round(ins.position?.y ?? 0)
      const pickupKey = posKey(ix - v.x, iy - v.y)
      const dropKey = posKey(ix + v.x, iy + v.y)
      const pickupIsBelt = beltMap.has(pickupKey)
      const dropIsBelt = beltMap.has(dropKey)
      const pickupIsFurnace = furnaceMap.has(pickupKey)
      const dropIsFurnace = furnaceMap.has(dropKey)
      if (pickupIsBelt && dropIsFurnace) {
        // belt -> furnace (input)
        const root = find(pickupKey)
        inputCompRoots.add(root)
      } else if (pickupIsFurnace && dropIsBelt) {
        // furnace -> belt (output)
        const root = find(dropKey)
        outputCompRoots.add(root)
      }
    }

    // Prefer inserter-detected components; fall back to centroid heuristics
    let outputComponent: any = undefined
    if (outputCompRoots.size > 0) {
      const roots = Array.from(outputCompRoots)
      const chosen = compList.find(c => c.root === roots[0])
      if (chosen) outputComponent = chosen
    } else if (compList.length) {
      let best = compList[0]!
      for (const c of compList) if (Math.abs(c.cx - centerX) < Math.abs(best.cx - centerX)) best = c
      outputComponent = best
    }

    let inputCapacityPerSec = 0
    if (inputCompRoots.size > 0) {
      for (const r of inputCompRoots) {
        const c = compList.find(cc => cc.root === r)
        if (c) inputCapacityPerSec += c.cap
      }
    } else if (compList.length) {
      // fallback: use leftmost and rightmost components
      let bestL = compList[0]!, bestR = compList[0]!
      for (const c of compList) {
        if (Math.abs(c.cx - minX) < Math.abs(bestL.cx - minX)) bestL = c
        if (Math.abs(c.cx - maxX) < Math.abs(bestR.cx - maxX)) bestR = c
      }
      inputCapacityPerSec = bestL.cap + (bestR === bestL ? 0 : bestR.cap)
    }
    const effectiveOreInputPerSec = inputCapacityPerSec / 2
    const outputCapacityPerSec = outputComponent ? outputComponent.cap : maxComponentCapacity

  // (connected component belt analysis completed above)

  const meta: any = {
    input_file: input,
    total_entities: entities.length,
    recipe: recipeName ?? 'unnamed',
  recipe_time_sec: recipeTime,
    throughput,
    counts,
    
    belt_components_count: compList.length,
    belt_components: compList.map(c => ({ cap: c.cap, cx: c.cx, cy: c.cy, size: c.size })),
    input_components: (function(){
      const arr: Array<any> = []
      if (typeof inputCompRoots !== 'undefined' && inputCompRoots.size>0) {
        for (const r of Array.from(inputCompRoots)) {
          const c = compList.find(cc => cc.root === r)
          if (c) arr.push({ cap: c.cap, cx: c.cx })
        }
      } else if (compList.length) {
        let bestL = compList[0]!, bestR = compList[0]!
        for (const c of compList) {
          if (Math.abs(c.cx - minX) < Math.abs(bestL.cx - minX)) bestL = c
          if (Math.abs(c.cx - maxX) < Math.abs(bestR.cx - maxX)) bestR = c
        }
        arr.push({ cap: bestL.cap, cx: bestL.cx })
        if (bestR !== bestL) arr.push({ cap: bestR.cap, cx: bestR.cx })
      }
      return arr
    })(),
    output_component: outputComponent ? { cap: outputComponent.cap, cx: outputComponent.cx } : null,
    input_capacity_per_sec: inputCapacityPerSec,
    effective_ore_input_per_sec: effectiveOreInputPerSec,
    output_capacity_per_sec: outputCapacityPerSec,
    belt_bottleneck: throughput.totalPerSec >= outputCapacityPerSec,
  }

  const out = JSON.stringify(meta, null, 2)
  if (outFile) {
    await fs.writeFile(outFile, out, 'utf8')
    console.log(`Wrote flow metrics to ${outFile}`)
  } else {
    process.stdout.write(out + '\n')
  }
}

main().catch((e) => {
  try {
    const util = require('util')
    console.error('Flow error:', e && e.stack ? e.stack : util.inspect(e, { depth: null }))
  } catch (err) {
    console.error('Flow error (failed to inspect):', e)
  }
  process.exit(1)
})
