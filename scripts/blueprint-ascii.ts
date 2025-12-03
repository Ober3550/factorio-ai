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
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--quiet' || a === '-q') {
      quiet = true
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

  if (outFile) {
    // Write the stable grid-only representation to file so golden files are deterministic
    await fs.writeFile(outFile, gridOnly, 'utf8')
    // When writing to a file, avoid printing debug data; only print a short confirmation
    if (!quiet) console.log(`Wrote ASCII output to ${outFile}`)
  } else {
    // Print the full (labeled) output to stdout for interactive use
    process.stdout.write(fullOut)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
