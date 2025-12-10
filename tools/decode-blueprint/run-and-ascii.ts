import { spawnSync } from 'child_process'
import * as path from 'path'

function run(command: string, args: string[]) {
  const res = spawnSync(command, args, { stdio: 'inherit' })
  if (res.error) throw res.error
  if (res.status !== 0) process.exit(res.status ?? 1)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 1) {
    console.error('Usage: node --loader ts-node/esm tools/decode-blueprint/run-and-ascii.ts <input.bp>')
    process.exit(2)
  }

  const input = argv[0]
  if (!input) {
    console.error('Missing input path')
    process.exit(2)
  }
  const bpPath = path.resolve(input)

  // Run the decoder: this will write <same-dir>/<basename>.json by default
  run('node', ['--loader', 'ts-node/esm', path.join('tools', 'decode-blueprint', 'index.ts'), bpPath])

  const outJson = bpPath.replace(/\.bp$/i, '.json')

  // Run the ASCII renderer on the produced JSON
  run('node', ['--loader', 'ts-node/esm', path.join('tools', 'blueprint-ascii', 'index.ts'), outJson])
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
