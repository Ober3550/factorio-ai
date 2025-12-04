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

  // Snap positions to the nearest 0.5 tile so floating-point noise from
  // rotations/translations doesn't produce slightly different coordinates that
  // prevent deduplication of shared-edge entities (especially belts).
  function snapToHalf(n: number) {
    return Math.round(n * 2) / 2
  }

  const sx = snapToHalf(nx)
  const sy = snapToHalf(ny)

  const out: Entity = { ...e, position: { x: sx, y: sy } }

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
      // When rotating the bottom half by 180°, also horizontally flip that tile so
      // belt directions remain consistent (belts need a mirror flip after a
      // 180° rotation to keep their flow orientation matching the rest of the
      // composed layout).
      let tileRot = rot
      let tileFlipX = flipX
      let tileFlipY = flipY
      if (rotateBottom && r >= Math.floor(rows / 2)) {
        tileRot = (rot + 2) & 3
        tileFlipX = !flipX
      }

  // compute this tile's footprint so we can align its xStart/yStart to the base footprint
  // Use the per-tile flip flags (tileFlipX/tileFlipY) so rotated+flipped
  // bottom tiles align correctly with the top row.
        const tileFoot = footprintBounds(normEntities, tileRot, tileFlipX, tileFlipY)
      const alignX = baseFoot.xStart - tileFoot.xStart
      const alignY = baseFoot.yStart - tileFoot.yStart

      for (const e of normEntities) {
        // apply transform then add extra alignment shift so rotated tiles sit under/over correctly
        const ne = applyTransform(e, tileFlipX, tileFlipY, tileRot, tx + alignX, ty + alignY)
        outEntities.push(ne)
      }
    }
  }

  // deduplicate overlapping entities (when sharing edges) by name+position+direction
  const deduped: Entity[] = []
  const seen = new Set<string>()
  for (const e of outEntities) {
    // Use one decimal place (positions are snapped to .0 or .5) for the key so
    // logically-identical positions compare equal despite small formatting
    // differences.
    const px = (e.position.x ?? 0).toFixed(1)
    const py = (e.position.y ?? 0).toFixed(1)
    const dirVal = typeof e.direction === 'number' ? e.direction : 'n'
    const k = `${e.name}@${px},${py}:dir=${dirVal}`
    if (seen.has(k)) continue
    seen.add(k)
    deduped.push(e)
  }

  // Ensure inserters face the expected drop target (usually a furnace).
  // Some tile rotations/flips could leave inserters pointing away from the
  // furnace and instead toward belts. We correct that by finding an adjacent
  // furnace (Manhattan distance ~= 1) and setting the inserter's direction to
  // point at that furnace. This guarantees the inserter will drop into the
  // furnace and therefore pick from the belt on the other side.
  for (const ins of deduped.filter((x) => x.name === 'inserter')) {
    const ix = Number(ins.position.x ?? 0)
    const iy = Number(ins.position.y ?? 0)
    const furn = deduped.find((e) => (e.name.includes('furnace') || e.name.includes('assembling-machine'))
      && Math.abs(Number(e.position.x) - ix) <= 1.1
      && Math.abs(Number(e.position.y) - iy) <= 1.1)
    if (!furn) continue
    const dx = Math.round(Number(furn.position.x) - ix)
    const dy = Math.round(Number(furn.position.y) - iy)
    const step = vecToDirStep({ x: dx, y: dy })
    ins.direction = step * 4
  }

  // Preserve any metadata from the input blueprint (icons, label, wires, version, etc.)
  // but replace the entities with our composed/deduplicated list. This keeps the
  // composed JSON compatible with Factorio's expected blueprint schema so it can
  // be imported directly in-game.
  const outBlueprint = { ...(bp ?? {}), entities: deduped }
  // Ensure minimal required fields exist
  outBlueprint.item = outBlueprint.item ?? 'blueprint'
  outBlueprint.version = outBlueprint.version ?? 5629499581399004

  // Assign unique entity_number values required by Factorio when importing
  // blueprints. Use a simple sequential numbering starting at 1.
  if (Array.isArray(outBlueprint.entities)) {
    for (let i = 0; i < outBlueprint.entities.length; i++) {
      outBlueprint.entities[i].entity_number = i + 1
    }
  }

  // Remove any existing wire configuration from the input blueprint so we
  // create a fresh wiring layout for the composed blueprint.
  outBlueprint.wires = []

  // Connect power poles in a square/grid pattern: for each pole, connect to
  // the nearest pole to the right (same y, x > current.x, distance <= 7)
  // and the nearest pole below (same x, y > current.y, distance <= 7).
  // Use entity_number indices in the wire tuples: [a, 5, b, 5]. The `5` is
  // used in existing exported blueprints and acts as the connection index.
  const poles: Array<{ id: number; x: number; y: number }> = (outBlueprint.entities ?? [])
    .filter((e: any) => e.name === 'small-electric-pole' || e.name === 'medium-electric-pole' || e.name === 'big-electric-pole')
    .map((e: any) => ({ id: e.entity_number as number, x: Number(e.position.x), y: Number(e.position.y) }))

  const wires: any[] = []
  const seenPairs = new Set<string>()

  // Helper to add pair once
  function addPair(a: number, b: number) {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`
    if (seenPairs.has(k)) return
    seenPairs.add(k)
    wires.push([a, 5, b, 5])
  }

  for (const p of poles) {
    // find nearest to the right (same y)
    const sameRow = poles.filter((q: { id: number; x: number; y: number }) => Math.abs(q.y - p.y) < 1e-6 && q.x > p.x && Math.abs(q.x - p.x) <= 7)
    if (sameRow.length > 0) {
      sameRow.sort((a: { id: number; x: number; y: number }, b: { id: number; x: number; y: number }) => (a.x - p.x) - (b.x - p.x))
  addPair(p.id, sameRow[0]!.id)
    }
    // find nearest below (same x)
    const sameCol = poles.filter((q: { id: number; x: number; y: number }) => Math.abs(q.x - p.x) < 1e-6 && q.y > p.y && Math.abs(q.y - p.y) <= 7)
    if (sameCol.length > 0) {
      sameCol.sort((a: { id: number; x: number; y: number }, b: { id: number; x: number; y: number }) => (a.y - p.y) - (b.y - p.y))
  addPair(p.id, sameCol[0]!.id)
    }
  }

  // Attach the generated wires to the blueprint
  outBlueprint.wires = wires

  // Auto-connect nearby power poles (small-electric-pole) to form a grid-like
  // wiring pattern. Poles connect when aligned on the same X or Y and within
  // a 7-tile radius. Connect nearest neighbors in each axis to form squares.
  try {
    const existingWires = Array.isArray(outBlueprint.wires) ? outBlueprint.wires.slice() : []
    const poles = (outBlueprint.entities ?? []).filter((e: any) => e.name === 'small-electric-pole')
      .map((p: any) => ({ x: Number((p.position.x ?? 0).toFixed(1)), y: Number((p.position.y ?? 0).toFixed(1)) }))

    const wireSet = new Set(existingWires.map((w: any) => w.join(',')))
    const newWires: Array<any> = []

    // group by X and connect vertical neighbors
    const byX = new Map<string, Array<{x:number,y:number}>>()
    for (const p of poles) {
      const key = p.x.toFixed(1)
      let arr = byX.get(key)
      if (!arr) { arr = []; byX.set(key, arr) }
      arr.push(p)
    }
    for (const [kx, arr] of byX) {
      arr.sort((a,b)=>a.y-b.y)
      for (let i=0;i+1<arr.length;i++){
        const a = arr[i]
        const b = arr[i+1]
        if (!a || !b) continue
        if (Math.abs(b.y - a.y) <= 7) {
          const key = `${a.x},${a.y},${b.x},${b.y}`
          if (!wireSet.has(key)) { wireSet.add(key); newWires.push([a.x,a.y,b.x,b.y]) }
        }
      }
    }

    // group by Y and connect horizontal neighbors
    const byY = new Map<string, Array<{x:number,y:number}>>()
    for (const p of poles) {
      const key = p.y.toFixed(1)
      let arr = byY.get(key)
      if (!arr) { arr = []; byY.set(key, arr) }
      arr.push(p)
    }
    for (const [ky, arr] of byY) {
      arr.sort((a,b)=>a.x-b.x)
      for (let i=0;i+1<arr.length;i++){
        const a = arr[i]
        const b = arr[i+1]
        if (!a || !b) continue
        if (Math.abs(b.x - a.x) <= 7) {
          const key = `${a.x},${a.y},${b.x},${b.y}`
          if (!wireSet.has(key)) { wireSet.add(key); newWires.push([a.x,a.y,b.x,b.y]) }
        }
      }
    }

    outBlueprint.wires = existingWires.concat(newWires)
  } catch (err) {
    // non-fatal: wiring is a best-effort convenience
    console.error('Failed to auto-generate wires:', err)
  }

  const out = { blueprint: outBlueprint }
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
