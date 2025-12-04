import { promises as fs } from 'fs'
import * as path from 'path'

type Entity = {
  name: string
  position: { x: number; y: number }
  direction?: number
}

// Character map requested by user. Use uppercase for multi-tile entities.
const CHAR_MAP: Record<string, string> = {
  boiler: 'B',
  'steam-engine': 'S',
  'small-electric-pole': 'e',
  inserter: 'i',
  pipe: 'p',
  'transport-belt': 'b',
  'stone-furnace': 'F',
  'assembling-machine-1': 'A',
  'assembling-machine-2': 'A',
  'assembling-machine-3': 'A',
}

// Size map in tiles (width, height) in default orientation
const SIZE_MAP: Record<string, [number, number]> = {
  // Note: sizes are [width, height] in default orientation
  // Restored original sizes: boiler 3x2, steam-engine 3x5
  boiler: [3, 2],
  'steam-engine': [3, 5],
  'stone-furnace': [2, 2],
  'assembling-machine-1': [3, 3],
  'assembling-machine-2': [3, 3],
  'assembling-machine-3': [3, 3],
  // default 1x1 for simple entities
  'small-electric-pole': [1, 1],
  inserter: [1, 1],
  pipe: [1, 1],
}

// Priority for overlapping placements (higher number wins)
const PRIORITY: Record<string, number> = {
  'steam-engine': 5,
  boiler: 4,
  'assembling-machine-1': 4,
  'assembling-machine-2': 4,
  'assembling-machine-3': 4,
  'small-electric-pole': 3,
  inserter: 2,
  pipe: 1,
}

function roundToTile(n: number) {
  // Round to nearest integer tile coordinate
  // Many blueprint positions are on .5 increments. We'll snap to the nearest half
  // then convert to integer tile coordinates by rounding.
  return Math.round(Math.round(n * 2) / 2)
}

async function main() {
  const argv = process.argv.slice(2)

  // Simple arg parsing: [--quiet|-q] [--out|-o <file>] <blueprint.json>
  let inputArg: string | undefined
  let quiet = false
  let outFile: string | undefined
  let zoom3 = false
  let zoom2 = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--quiet' || a === '-q') {
      quiet = true
      continue
    }
    if (a === '--zoom-3') {
      zoom3 = true
      continue
    }
    if (a === '--zoom-2') {
      zoom2 = true
      continue
    }
    if (a === '--out' || a === '-o') {
      i++
      outFile = argv[i]
      continue
    }
    if (!inputArg) inputArg = a
  }

  if (!inputArg) {
    console.error('Usage: node --loader ts-node/esm scripts/blueprint-ascii.ts [--quiet|-q] [--out|-o <file>] <blueprint.json>')
    process.exit(2)
  }

  const input = path.resolve(inputArg)
  const raw = await fs.readFile(input, 'utf8')
  const json = JSON.parse(raw)
  const bp = json.blueprint ?? json
  const entities: Entity[] = bp.entities ?? []

  // Determine bounds by computing continuous footprints then mapping to integer tiles.
  // This uses exact spans so adjacent entities (like boilers and inserters) align without gaps.
  const footprints: Array<{
    name: string
    xStart: number
    xEnd: number
    yStart: number
    yEnd: number
    prio: number
    ch: string
  }> = []

  for (const ent of entities) {
    const name = ent.name
    const ch = CHAR_MAP[name] ?? '?'
    let [w, h] = SIZE_MAP[name] ?? [1, 1]
    const dir = typeof ent.direction === 'number' ? ent.direction : 0
    // Factorio blueprint directions use multiples where:
    //   north = 0, east = 4, south = 8, west = 12
    // Map this to a 0..3 rotation (0 = north, 1 = east, 2 = south, 3 = west).
    // For 90 or 270 degree rotations (rot === 1 or rot === 3) swap width/height.
    const rot = Math.floor(dir / 4) % 4
    if (rot % 2 === 1) {
      ;[w, h] = [h, w]
    }

    const cx = ent.position.x
    const cy = ent.position.y

    // Continuous span
    const left = cx - w / 2
    const right = cx + w / 2
    const top = cy - h / 2
    const bottom = cy + h / 2

    const xStart = Math.floor(left)
    const xEnd = Math.ceil(right) - 1
    const yStart = Math.floor(top)
    const yEnd = Math.ceil(bottom) - 1

    footprints.push({ name, xStart, xEnd, yStart, yEnd, prio: PRIORITY[name] ?? 0, ch })
  }

  // Debug: print computed footprints (helps verify why overlaps happen)
  // When writing to a file, suppress debug output to keep file contents stable.
  if (!quiet && !outFile) console.debug(JSON.stringify(footprints, null, 2))

  if (footprints.length === 0) {
    console.error('No entities found in blueprint')
    process.exit(1)
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const f of footprints) {
    minX = Math.min(minX, f.xStart)
    minY = Math.min(minY, f.yStart)
    maxX = Math.max(maxX, f.xEnd)
    maxY = Math.max(maxY, f.yEnd)
  }

  const width = maxX - minX + 1
  const height = maxY - minY + 1

  // Initialize grid
  const grid: string[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => '.'))
  const prioGrid: number[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => 0))

  // Map each base tile to the chosen entity (by priority) so zoomed render can
  // display per-tile entity metadata (like direction) rather than only a char.
  const tileEntities: Array<Array<Entity | null>> = Array.from({ length: height }, () => Array.from({ length: width }, () => null))
  for (const ent of entities) {
    const name = ent.name
    let [w, h] = SIZE_MAP[name] ?? [1, 1]
    const dir = typeof ent.direction === 'number' ? ent.direction : 0
    const rot = Math.floor(dir / 4) % 4
    if (rot % 2 === 1) [w, h] = [h, w]
    const cx = ent.position.x
    const cy = ent.position.y
    const left = Math.floor(cx - w / 2)
    const right = Math.ceil(cx + w / 2) - 1
    const top = Math.floor(cy - h / 2)
    const bottom = Math.ceil(cy + h / 2) - 1
    for (let x = left; x <= right; x++) {
      for (let y = top; y <= bottom; y++) {
        const ix = x - minX
        const iy = y - minY
        if (ix < 0 || ix >= width || iy < 0 || iy >= height) continue
        const cur = tileEntities[iy]![ix]
        const curPrio = cur ? (PRIORITY[cur.name] ?? 0) : -1
        const entPrio = PRIORITY[name] ?? 0
        if (!cur || entPrio >= curPrio) tileEntities[iy]![ix] = ent
      }
    }
  }

  // Place footprints
  for (const f of footprints) {
    const gx = f.xStart - minX
    const gy = f.yStart - minY
    for (let x = f.xStart; x <= f.xEnd; x++) {
      for (let y = f.yStart; y <= f.yEnd; y++) {
        const ix = x - minX
        const iy = y - minY
        if (ix < 0 || ix >= width || iy < 0 || iy >= height) continue
        // Show collisions explicitly: if a tile is already occupied by a different symbol,
        // mark it with '+' so overlaps are obvious in the ASCII render.
        const existing = grid[iy]![ix] ?? '.'
        if (existing === '.' || existing === undefined) {
          grid[iy]![ix] = f.ch
          prioGrid[iy]![ix] = f.prio
        } else if (existing === f.ch || existing === '+') {
          // same symbol or already collision: keep it and update priority to max
          prioGrid[iy]![ix] = Math.max(prioGrid[iy]![ix] ?? 0, f.prio)
        } else {
          // different symbol already present -> mark collision
          grid[iy]![ix] = '+'
          prioGrid[iy]![ix] = Math.max(prioGrid[iy]![ix] ?? 0, f.prio)
        }
      }
    }
  }

  // Debug print: show bounds
  if (!quiet && !outFile) console.debug({ minX, minY, width, height })

  // Build two output forms:
  // - fullOut: includes coordinate header and row labels (useful for interactive debugging)
  // - gridOnly: just the raw grid lines (stable for golden files)
  let fullOut = ''
  // header indices
  const cols: string[] = []
  for (let x = 0; x < width; x++) cols.push(((minX + x) % 10).toString())
  fullOut += '   ' + cols.join('') + '\n'
  for (let y = 0; y < height; y++) {
    fullOut += (minY + y).toString().padStart(3, ' ') + ' ' + grid[y]!.join('') + '\n'
  }

  // gridOnly: stable golden-file format (no coordinates)
  const gridOnly = grid.map((row) => row.join('')).join('\n') + '\n'

  // If zoomed 3x mode requested, create an expanded grid where each base
  // tile is represented by a 3x3 block so we can show facing/directional
  // cues (arrows) and clearer multi-tile shapes.
  let zoom3Out: string | null = null
  if (zoom3) {
    const subH = height * 3
    const subW = width * 3
    const sub: string[][] = Array.from({ length: subH }, () => Array.from({ length: subW }, () => ' '))

    // helper for arrow placement
    const dirChar = (d: number | undefined, name?: string) => {
      const arrows = ['^', '>', 'v', '<']
      if (typeof d !== 'number') return { center: CHAR_MAP[name ?? ''] ?? '.', arrow: '?', top: ' ', left: ' ', right: ' ', bottom: ' ' }
      const step = Math.floor(d / 4) & 3
      const arrow = arrows[step]
      return { center: CHAR_MAP[name ?? ''] ?? '.', arrow, top: step === 0 ? '^' : ' ', left: step === 3 ? '<' : ' ', right: step === 1 ? '>' : ' ', bottom: step === 2 ? 'v' : ' ' }
    }

    for (let by = 0; by < height; by++) {
      for (let bx = 0; bx < width; bx++) {
        const ent = tileEntities[by]![bx]
  const baseCh = ent ? (CHAR_MAP[ent.name] ?? '?') : '.'
  const dInfo = dirChar(ent && typeof ent.direction === 'number' ? ent.direction : undefined, ent?.name)
  const center = (dInfo as any).center
  const top = (dInfo as any).top
  const left = (dInfo as any).left
  const right = (dInfo as any).right
  const bottom = (dInfo as any).bottom
  const arrowSym = (dInfo as any).arrow
        // place into sub grid
        const ox = bx * 3
        const oy = by * 3
        // default fill
        sub[oy + 0]![ox + 0] = ' '
        sub[oy + 0]![ox + 1] = top
        sub[oy + 0]![ox + 2] = ' '
        sub[oy + 1]![ox + 0] = left
    // choose center symbol: belts show arrow center to indicate flow
  if (ent && ent.name === 'transport-belt') sub[oy + 1]![ox + 1] = (ent.direction !== undefined) ? arrowSym : baseCh
  else sub[oy + 1]![ox + 1] = center
        sub[oy + 1]![ox + 2] = right
        sub[oy + 2]![ox + 0] = ' '
        sub[oy + 2]![ox + 1] = bottom
        sub[oy + 2]![ox + 2] = ' '
      }
    }

    // Compose zoom3Out string with coordinates scaled accordingly
    const headCols: string[] = []
    for (let x = 0; x < subW; x++) headCols.push((x % 10).toString())
    let sb = ''
    sb += '    ' + headCols.join('') + '\n'
    for (let y = 0; y < subH; y++) {
      sb += (Math.floor(minY) + Math.floor(y / 3)).toString().padStart(4, ' ') + ' ' + sub[y]!.join('') + '\n'
    }
    zoom3Out = sb
  }

  // 2x2 densified zoom: each tile becomes a 2x2 block. Place the arrow in the
  // cell corresponding to the inserter's output direction and place the entity
  // char on the opposite corner to make pickup vs drop visually clear.
  let zoom2Out: string | null = null
  if (zoom2) {
    const subH = height * 2
    const subW = width * 2
    const sub: string[][] = Array.from({ length: subH }, () => Array.from({ length: subW }, () => ' '))

  const arrowChars = ['^', '>', 'v', '<']
    

    for (let by = 0; by < height; by++) {
      for (let bx = 0; bx < width; bx++) {
        const ent = tileEntities[by]![bx]
  const entChar: string = ent ? (CHAR_MAP[ent.name] ?? '?') : '.'
        const ox = bx * 2
        const oy = by * 2
        if (ent && typeof ent.direction === 'number') {
          const step = Math.floor(ent.direction / 4) & 3
          // inline mapping where arrow is orthogonally adjacent to the entity
          // Arrow is placed on the PICKUP side and points in the direction
          // items will move (toward the drop side). Prefer to keep the entity
          // character in the top-left of the 2x2 block unless the arrow needs
          // that cell; in that case the entity is moved to the adjacent cell.
          // Mapping (step: drop direction -> pickup location / entity location):
          // 0 (north): pickup is south -> arrow at (0,1), entity at (0,0)
          // 1 (east):  pickup is west  -> arrow at (0,0), entity at (1,0)
          // 2 (south): pickup is north -> arrow at (0,0), entity at (0,1)
          // 3 (west):  pickup is east  -> arrow at (1,0), entity at (0,0)
          // Compute entity/arrow positions so the arrow points AWAY from the
          // entity (i.e. arrow direction == arrow_pos - entity_pos). Prefer
          // the entity to sit at top-left (0,0) unless that would put the
          // arrow outside the 2x2 block, in which case move the entity one
          // step opposite the arrow to keep both inside.
          let ex = 0, ey = 0
          const dirs = [ { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 } ]
          // Special-case: inserters use a different convention for the
          // direction field: the side indicated by the direction is the
          // pickup side relative to the inserter. Visual mapping should
          // therefore rotate by +2 (180°) so the arrow we draw (which is
          // placed on the pickup tile and points toward the drop) matches
          // in-game behaviour.
          const visualStepBase = (ent && ent.name === 'inserter') ? ((step + 2) & 3) : step
          const d = dirs[visualStepBase & 3] as { x: number; y: number }
          let ax = ex + d.x
          let ay = ey + d.y
          if (ax < 0 || ax > 1 || ay < 0 || ay > 1) {
            // move entity opposite the arrow so arrow lands inside the 2x2
            ex = ex - d.x
            ey = ey - d.y
            ax = ex + d.x
            ay = ey + d.y
          }
          // place entity char and arrow; arrow points in flow direction
          sub[oy + ey]![ox + ex] = entChar
          sub[oy + ay]![ox + ax] = arrowChars[visualStepBase]!
        } else {
          // no direction: place center on bottom-right
          sub[oy + 1]![ox + 1] = entChar
        }
      }
    }

    // Compose zoom2Out string
    const headCols: string[] = []
    for (let x = 0; x < subW; x++) headCols.push((x % 10).toString())
    let sb2 = ''
    sb2 += '   ' + headCols.join('') + '\n'
    for (let y = 0; y < subH; y++) {
      sb2 += (Math.floor(minY) + Math.floor(y / 2)).toString().padStart(3, ' ') + ' ' + sub[y]!.join('') + '\n'
    }
    zoom2Out = sb2
  }

  if (outFile) {
    // When writing to a file, prefer zoomed outputs if requested
    const toWrite = zoom3 && zoom3Out ? zoom3Out : (zoom2 && zoom2Out ? zoom2Out : gridOnly)
    await fs.writeFile(outFile, toWrite, 'utf8')
    // When writing to a file, avoid printing debug data; only print a short confirmation
    if (!quiet) console.log(`Wrote ASCII output to ${outFile}`)
  } else {
    // Print the full (labeled) output to stdout for interactive use
    if (zoom3 && zoom3Out) process.stdout.write(zoom3Out)
    else if (zoom2 && zoom2Out) process.stdout.write(zoom2Out)
    else process.stdout.write(fullOut)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
