import { promises as fs } from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 1) {
    console.error('Usage: node --loader ts-node/esm tools/encode-blueprint/index.ts <blueprint.json> [--out|-o <file>] [--pretty]')
    process.exit(2)
  }

  let inputArg: string | undefined
  let outFile: string | undefined
  let pretty = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out' || a === '-o') {
      i++
      outFile = argv[i]
      continue
    }
    if (a === '--pretty') {
      pretty = true
      continue
    }
    if (!inputArg) inputArg = a
  }

  if (!inputArg) {
    console.error('Missing input file')
    process.exit(2)
  }

  const inputPath = path.resolve(inputArg)
  const raw = await fs.readFile(inputPath, 'utf8')

  let parsed: any = null
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    // If the file isn't valid JSON, try to compress the raw contents directly.
    // But usually users will pass the parsed blueprint JSON.
  }

  // Factorio expects the blueprint object itself, or an object with a top-level
  // `blueprint` property. Accept either.
  const blueprintObj = parsed ?? null

  let text: string
  if (blueprintObj) {
    text = pretty ? JSON.stringify(blueprintObj, null, 2) : JSON.stringify(blueprintObj)
  } else {
    // fallback: compress the raw file contents
    text = raw
  }

  // Use zlib.deflateSync to produce the common zlib-compressed form that
  // matches the decoder's preferred inflateSync attempt.
  const compressed = zlib.deflateSync(Buffer.from(text, 'utf8'))
  const b64 = compressed.toString('base64')

  // Factorio blueprint strings commonly have a single-character prefix.
  // Use '0' as the default prefix used by many exporters.
  const bpString = '0' + b64

  if (outFile) {
    const outPath = path.resolve(outFile)
    await fs.writeFile(outPath, bpString + '\n', 'utf8')
    console.log(`Wrote blueprint string to ${outPath}`)
  } else {
    // Print to stdout for piping
    process.stdout.write(bpString + '\n')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
