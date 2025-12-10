import { promises as fs } from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'

function tryDecompress(buffer: any): string | null {
  // Try common decompression strategies used by Factorio blueprints
  const attempts = [
    (b: any) => zlib.gunzipSync(b),
    (b: any) => zlib.inflateSync(b),
    (b: any) => zlib.inflateRawSync(b),
  ]

  for (const fn of attempts) {
    try {
      const out = fn(buffer)
      return out.toString('utf8')
    } catch (e) {
      // continue trying
    }
  }

  return null
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 1) {
    console.error('Usage: ts-node tools/decode-blueprint/index.ts <input.bp> [output.json]')
    process.exit(2)
  }

  const inputArg = argv[0]
  if (!inputArg) {
    console.error('Missing input path')
    process.exit(2)
  }

  const inputPath = path.resolve(inputArg)
  const outputPath = argv[1]
    ? path.resolve(argv[1])
    : path.join(path.dirname(inputPath), path.basename(inputPath, path.extname(inputPath)) + '.json')

  let raw = await fs.readFile(inputPath, 'utf8')
  raw = raw.trim()

  // Factorio blueprint strings commonly start with a single-character prefix
  // (often "0" or "1") followed by the base64-encoded zlib-compressed JSON.
  // Strip that single prefix character when present.
  let b64 = raw
  const prefix = b64.charAt(0)
  if (prefix === '0' || prefix === '1') {
    b64 = b64.slice(1)
  }

  let decoded: any
  try {
    decoded = Buffer.from(b64, 'base64')
  } catch (err) {
    console.error('Failed to base64-decode the input file:', err)
    process.exit(3)
    return
  }

  // First try to decompress using zlib.inflate (this matches Python's zlib.compress).
  // Fall back to gunzip and raw inflate if needed. If none succeed, treat as UTF-8 text.
  function tryDecompressPreferZlib(buffer: any): string | null {
    const attempts = [
      (b: any) => zlib.inflateSync(b),
      (b: any) => zlib.gunzipSync(b),
      (b: any) => zlib.inflateRawSync(b),
    ]

    for (const fn of attempts) {
      try {
        const out = fn(buffer)
        return out.toString('utf8')
      } catch (e) {
        // continue trying
      }
    }

    return null
  }

  let text: string = tryDecompressPreferZlib(decoded) ?? decoded.toString('utf8')

  // Try to parse as JSON. If parse fails, still write the raw text to output.
  let outContent: string
  try {
    const parsed = JSON.parse(text as string)
    // Only set a default direction for inserters and belts. Some blueprints
    // intentionally omit direction for entities where it isn't required,
    // so avoid forcing a value for everything. We target `inserter` and any
    // entity whose name contains 'belt' (transport/underground/fast/etc.).
    const bp = (parsed && parsed.blueprint) ? parsed.blueprint : parsed
    if (bp && Array.isArray(bp.entities)) {
      for (const e of bp.entities) {
        const name = typeof e.name === 'string' ? e.name : ''
        const isBelt = name.includes('belt')
        const isInserter = name === 'inserter'
        if (typeof e.direction === 'undefined' && (isInserter || isBelt)) {
          e.direction = 0
        }
      }
    }
    outContent = JSON.stringify(parsed, null, 2)
  } catch (e) {
    // Not valid JSON; write the text as-is
    outContent = text
  }

  await fs.writeFile(outputPath, outContent, 'utf8')
  console.log(`Wrote decoded output to ${outputPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
