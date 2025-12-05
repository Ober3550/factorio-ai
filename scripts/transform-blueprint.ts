import { promises as fs } from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'

type Entity = { name: string; position: { x: number; y: number }; direction?: number; [k: string]: any }

function dirStepToVec(step: number) {
  switch (step & 3) {
    case 0: return { x: 0, y: -1 }
    case 1: return { x: 1, y: 0 }
    case 2: return { x: 0, y: 1 }
    default: return { x: -1, y: 0 }
  }
}

function vecToDirStep(v: { x: number; y: number }) {
  if (v.x === 0 && v.y === -1) return 0
  if (v.x === 1 && v.y === 0) return 1
  if (v.x === 0 && v.y === 1) return 2
  return 3
}

function rotatePos(x: number, y: number, rot: number) {
  // Rotate clockwise by 90° per step: (x, y) -> (y, -x)
  let nx = x, ny = y
  for (let i = 0; i < (rot & 3); i++) {
    const tx = nx
    nx = ny
    ny = -tx
  }
  return { x: nx, y: ny }
}

function rotatePosClockwise(x: number, y: number, rot: number) {
  // Rotate clockwise: (x, y) -> (y, -x)
  // For 90° clockwise: (1, 0) -> (0, -1), (0, 1) -> (1, 0)
  let nx = x, ny = y
  for (let i = 0; i < (rot & 3); i++) {
    const tx = nx
    nx = -ny
    ny = tx
  }
  return { x: nx, y: ny }
}

function flipEntity(ent: Entity, fx: boolean, fy: boolean): Entity {
  const out: Entity = { ...ent }
  let x = ent.position.x
  let y = ent.position.y
  if (fx) x = -x
  if (fy) y = -y
  out.position = { x, y }
  if (typeof ent.direction === 'number') {
    const step = Math.floor(ent.direction / 4) & 3
    const vec = dirStepToVec(step)
    let vx = vec.x, vy = vec.y
    if (fx) vx = -vx
    if (fy) vy = -vy
    const newStep = vecToDirStep({ x: Math.round(vx), y: Math.round(vy) })
    out.direction = newStep * 4
  }
  return out
}

function rotateEntity(ent: Entity, rotSteps: number): Entity {
  const out: Entity = { ...ent }
  const rpos = rotatePosClockwise(ent.position.x, ent.position.y, rotSteps)
  out.position = { x: rpos.x, y: rpos.y }
  if (typeof ent.direction === 'number') {
    const step = Math.floor(ent.direction / 4) & 3
    const vec = dirStepToVec(step)
    const rvec = rotatePosClockwise(vec.x, vec.y, rotSteps)
    const newStep = vecToDirStep({ x: Math.round(rvec.x), y: Math.round(rvec.y) })
    out.direction = newStep * 4
  }
  return out
}

function snapToHalf(n: number) {
  return Math.round(n * 2) / 2
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 1) {
    console.error('Usage: node --loader ts-node/esm scripts/transform-blueprint.ts <input.json|bp> [--rotate N] [--flip-x] [--flip-y] [--out out.json]')
    process.exit(2)
  }

  let input: string | undefined
  let rot = 0
  let fx = false
  let fy = false
  let outFile: string | undefined
  let stripEntityNumbers = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--rotate') { i++; rot = Number(argv[i]) & 3; continue }
    if (a === '--flip-x') { fx = true; continue }
    if (a === '--flip-y') { fy = true; continue }
  if (a === '--out' || a === '-o') { i++; outFile = argv[i]; continue }
  if (a === '--strip-entity-numbers') { stripEntityNumbers = true; continue }
    if (!input) input = a
  }

  if (!input) {
    console.error('Missing input')
    process.exit(2)
  }

  const raw = await fs.readFile(path.resolve(input), 'utf8')
  let json: any
  try {
    json = JSON.parse(raw)
  } catch (e) {
    // maybe it's a .bp compressed string? try decode script if available
    console.error('Input must be JSON blueprint file (decoded). Please run decode-blueprint.ts first.')
    process.exit(1)
  }

  const bp = json.blueprint ?? json
  const entities: Entity[] = (bp.entities ?? []).map((e: any) => ({ ...e, position: { x: Number(e.position.x), y: Number(e.position.y) } }))
  const transformed: Entity[] = []

  for (const e of entities) {
    let cur = { ...e }
    if (fx || fy) cur = flipEntity(cur, fx, fy)
    if (rot) cur = rotateEntity(cur, rot)
    cur.position = { x: snapToHalf(cur.position.x), y: snapToHalf(cur.position.y) }
    // by default we preserve entity_number so transformed blueprints can be
    // re-imported into the game without losing their ids. If the caller
    // explicitly requests stripping (to avoid collisions during composition),
    // they can pass `--strip-entity-numbers`.
    if (stripEntityNumbers) delete cur.entity_number
    transformed.push(cur)
  }

  // If inserters lack a direction, infer it from an adjacent furnace/assembler
  // so transformed tiles have usable inserter directions. This mirrors the
  // behavior in the composer which ensures inserters face the furnace.
  for (const ins of transformed.filter((x) => x.name === 'inserter')) {
    if (typeof ins.direction === 'number') continue
    const ix = Number(ins.position.x ?? 0)
    const iy = Number(ins.position.y ?? 0)
    const furn = transformed.find((e) => (e.name.includes('furnace') || e.name.includes('assembling-machine'))
      && Math.abs(Number(e.position.x) - ix) <= 1.1
      && Math.abs(Number(e.position.y) - iy) <= 1.1)
    if (!furn) continue
    const dx = Math.round(Number(furn.position.x) - ix)
    const dy = Math.round(Number(furn.position.y) - iy)
    ins.direction = vecToDirStep({ x: dx, y: dy }) * 4
  }

  const outBp = { ...(bp ?? {}), entities: transformed }
  const out = json.blueprint ? { blueprint: outBp } : outBp

  const dest = outFile ?? path.resolve(path.dirname(input), path.basename(input, path.extname(input)) + '_transformed.json')
  await fs.writeFile(dest, JSON.stringify(out, null, 2), 'utf8')
  console.log(`Wrote transformed blueprint to ${dest}`)
  // Run ASCII preview like composer does for quick visual verification
  try {
    const bin = process.execPath
    const args = ['--no-warnings', '--loader', 'ts-node/esm', 'scripts/blueprint-ascii.ts', dest, '--zoom-2']
    const p = spawnSync(bin, args, { cwd: path.resolve('.'), encoding: 'utf8' })
    if (p.error) console.error('preview error:', p.error)
    if (p.stdout) console.log(p.stdout)
    if (p.stderr) console.error(p.stderr)
  } catch (err) {
    console.error('Failed to run ascii preview:', err)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
