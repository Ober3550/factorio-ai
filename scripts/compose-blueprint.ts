import { promises as fs } from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'

type Entity = { name: string; position: { x: number; y: number }; direction?: number; [k: string]: any }

// Size map used to compute footprints when composing so tiles don't overlap
const SIZE_MAP: Record<string, [number, number]> = {
  boiler: [3, 2],
  'steam-engine': [3, 5],
  'stone-furnace': [2, 2],
  'steel-furnace': [2, 2],
  'electric-furnace': [2, 2],
  'assembling-machine-1': [3, 3],
  'assembling-machine-2': [3, 3],
  'assembling-machine-3': [3, 3],
  'small-electric-pole': [1, 1],
  inserter: [1, 1],
  pipe: [1, 1],
  'transport-belt': [1, 1],
}

function footprintBounds(entities: Entity[], rot = 0, flipX = false, flipY = false) {
  // compute continuous footprint extents for all entities after applying flip/rot
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const e of entities) {
    // base size
    const [w, h] = SIZE_MAP[e.name] ?? [1, 1]
    // direction-aware swap: if rotated 90/270 degrees, swap w/h
    const dir = typeof e.direction === 'number' ? Math.floor(e.direction / 4) % 4 : 0
    const rotTotal = (dir + rot) & 3
    let ew = w, eh = h
    if (rotTotal % 2 === 1) [ew, eh] = [eh, ew]

    // entity center position after flip/rotate
    let x = e.position.x
    let y = e.position.y
    if (flipX) x = -x
    if (flipY) y = -y
    const r = rotatePos(x, y, rot)

    const left = r.x - ew / 2
    const right = r.x + ew / 2
    const top = r.y - eh / 2
    const bottom = r.y + eh / 2

    minX = Math.min(minX, left)
    minY = Math.min(minY, top)
    maxX = Math.max(maxX, right)
    maxY = Math.max(maxY, bottom)
  }

  // convert continuous span to integer tile bounds
  const xStart = Math.floor(minX)
  const yStart = Math.floor(minY)
  const xEnd = Math.ceil(maxX) - 1
  const yEnd = Math.ceil(maxY) - 1
  return { xStart, yStart, xEnd, yEnd, width: xEnd - xStart + 1, height: yEnd - yStart + 1 }
}

function getBounds(entities: Entity[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const e of entities) {
    const x = e.position.x
    const y = e.position.y
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
}

function dirStepToVec(step: number) {
  switch (step & 3) {
    case 0: return { x: 0, y: -1 } // north
    case 1: return { x: 1, y: 0 } // east
    case 2: return { x: 0, y: 1 } // south
    default: return { x: -1, y: 0 } // west
  }
}

function vecToDirStep(v: { x: number; y: number }) {
  if (v.x === 0 && v.y === -1) return 0
  if (v.x === 1 && v.y === 0) return 1
  if (v.x === 0 && v.y === 1) return 2
  return 3
}

function rotatePos(x: number, y: number, rot: number) {
  // rot steps clockwise (1 = 90deg)
  let nx = x, ny = y
  for (let i = 0; i < (rot & 3); i++) {
    const tx = nx
    nx = ny
    ny = -tx
  }
  return { x: nx, y: ny }
}

function applyTransform(e: Entity, flipX: boolean, flipY: boolean, rot: number, tx: number, ty: number): Entity {
  let x = e.position.x
  let y = e.position.y
  if (flipX) x = -x
  if (flipY) y = -y
  const r = rotatePos(x, y, rot)
  const nx = r.x + tx
  const ny = r.y + ty

  const out: Entity = { ...e, position: { x: nx, y: ny } }

  if (typeof e.direction === 'number') {
    const step = Math.floor(e.direction / 4) & 3
    const vec = dirStepToVec(step)
    let vx = vec.x, vy = vec.y
    if (flipX) vx = -vx
    if (flipY) vy = -vy
    const rv = rotatePos(vx, vy, rot)
    const newStep = vecToDirStep({ x: Math.round(rv.x), y: Math.round(rv.y) })
    out.direction = newStep * 4
  }

  // remove any blueprint-specific tags like entity_number if present
  delete out.entity_number
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 1) {
    console.error('Usage: node --loader ts-node/esm scripts/compose-blueprint.ts <input.json> --cols N --rows M [--spacing-x S] [--spacing-y S] [--rotate R] [--flip-x] [--flip-y] [--normalize true] --out out.json')
    process.exit(2)
  }

  let input: string | undefined
  let cols = 1, rows = 1
  let spacingX = 1, spacingY = 1
  let rot = 0
  let flipX = false, flipY = false
  let outFile: string | undefined
  let normalize = true
  let shareX = false
  let shareY = false
  let rotateBottom = false
  let preview = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--cols') { i++; cols = Number(argv[i]); continue }
    if (a === '--rows') { i++; rows = Number(argv[i]); continue }
    if (a === '--spacing-x') { i++; spacingX = Number(argv[i]); continue }
    if (a === '--spacing-y') { i++; spacingY = Number(argv[i]); continue }
    if (a === '--rotate') { i++; rot = Number(argv[i]) & 3; continue }
    if (a === '--flip-x') { flipX = true; continue }
    if (a === '--flip-y') { flipY = true; continue }
    if (a === '--out' || a === '-o') { i++; outFile = argv[i]; continue }
    if (a === '--no-normalize') { normalize = false; continue }
    if (a === '--share-x') { shareX = true; continue }
    if (a === '--share-y') { shareY = true; continue }
    if (a === '--rotate-bottom') { rotateBottom = true; continue }
  if (a === '--preview') { preview = true; continue }
    if (!input) input = a
  }

  if (!input) {
    console.error('Missing input')
    process.exit(2)
  }

  const raw = await fs.readFile(path.resolve(input), 'utf8')
  const json = JSON.parse(raw)
  const bp = json.blueprint ?? json
  const unitEntities: Entity[] = bp.entities ?? []

  if (unitEntities.length === 0) {
    console.error('No entities in input')
    process.exit(1)
  }

  // normalize so unit starts at 0,0 (optional)
  let normEntities = unitEntities
  if (normalize) {
    // compute footprint-aware bounds so multi-tile entities are considered
    const fb = footprintBounds(unitEntities, 0, false, false)
    const minX = fb.xStart
    const minY = fb.yStart
    normEntities = unitEntities.map((e) => ({ ...e, position: { x: e.position.x - minX, y: e.position.y - minY } }))
  }

  // compute footprint bounds for the unit considering requested rotation/flip
  const unitFoot = footprintBounds(normEntities, rot, flipX, flipY)
  const unitWidth = unitFoot.width
  const unitHeight = unitFoot.height

  const outEntities: Entity[] = []
  // determine tile step to avoid overlaps. If sharing an edge, reduce step so tiles overlap by 1 tile
  const stepX = Math.max(1, Math.ceil(unitWidth + spacingX - (shareX ? 1 : 0)))
  const stepY = Math.max(1, Math.ceil(unitHeight + spacingY - (shareY ? 1 : 0)))

  // base footprint for alignment (using requested rot/flip for the canonical tile)
  const baseFoot = footprintBounds(normEntities, rot, flipX, flipY)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = c * stepX
      const ty = r * stepY
      // optionally rotate bottom half of the composed grid by 180deg so adjacent units can share belts
      let tileRot = rot
      if (rotateBottom && r >= Math.floor(rows / 2)) tileRot = (rot + 2) & 3

      // compute this tile's footprint so we can align its xStart/yStart to the base footprint
      const tileFoot = footprintBounds(normEntities, tileRot, flipX, flipY)
      const alignX = baseFoot.xStart - tileFoot.xStart
      const alignY = baseFoot.yStart - tileFoot.yStart

      for (const e of normEntities) {
        // apply transform then add extra alignment shift so rotated tiles sit under/over correctly
        const ne = applyTransform(e, flipX, flipY, tileRot, tx + alignX, ty + alignY)
        outEntities.push(ne)
      }
    }
  }

  // deduplicate overlapping entities (when sharing edges) by name+position+direction
  const deduped: Entity[] = []
  const seen = new Set<string>()
  for (const e of outEntities) {
    const k = `${e.name}@${e.position.x.toFixed(3)},${e.position.y.toFixed(3)}:dir=${typeof e.direction==='number'?e.direction:'n'}`
    if (seen.has(k)) continue
    seen.add(k)
    deduped.push(e)
  }

  const out = { blueprint: { entities: deduped } }
  if (outFile) {
    await fs.writeFile(outFile, JSON.stringify(out, null, 2), 'utf8')
    console.log(`Wrote composed blueprint to ${outFile}`)
  } else {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n')
  }

  if (preview && outFile) {
    try {
      // run the ascii renderer for quick verification
      const bin = process.execPath
      const args = ['--no-warnings', '--loader', 'ts-node/esm', 'scripts/blueprint-ascii.ts', outFile]
      const p = spawnSync(bin, args, { cwd: path.resolve('.'), encoding: 'utf8' })
      if (p.error) console.error('preview error:', p.error)
      if (p.stdout) console.log(p.stdout)
      if (p.stderr) console.error(p.stderr)
    } catch (err) {
      console.error('Failed to run preview:', err)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
