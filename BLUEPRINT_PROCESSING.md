## Blueprint processing rules

This document describes the pipeline and rules used by the tools in this repository to intake a Factorio blueprint ("bp") file and produce usable outputs (JSON and ASCII renderings).

### Goals
- Explain the exact steps taken when decoding a `.bp` blueprint string.
- Document decompression choices and why they're ordered the way they are.
- Describe how footprints and ASCII rendering are computed.
- Provide CLI commands and troubleshooting tips so the scripts can be used reliably.

### Input formats supported
- `.bp` — a single blueprint encoded string. Common format in this repo: a single-character prefix (often `0` or `1`) followed by base64 of a zlib-compressed JSON blueprint.
- `.json` — decoded blueprint JSON (produced by the decoder or exported from game/mods).

If you have a blueprint book (multiple blueprints), the decoder may output the top-level JSON for the book; the renderer currently expects a single blueprint JSON object under the `blueprint` key.

### High-level pipeline
1. Read the input file as UTF-8 text.
2. Trim whitespace and strip a single leading prefix character when present (common values: `0`, `1`).
3. Base64-decode the remaining text into bytes.
4. Attempt decompression in this order:
   - `zlib.inflate` (matches Python's `zlib.compress` encoding used in some code).
   - `zlib.gunzip` (fallback in case the data is gzipped).
   - `zlib.inflateRaw` (raw deflate streams without zlib headers).
   The first successful decompression is used; if none succeed the bytes are interpreted as UTF-8 text.
5. Parse the decompressed text as JSON. If parsing fails, the raw text is written for inspection.
6. Write pretty JSON to an output file (same folder as input .bp by default, `.json` extension).

### Why `zlib.inflate` first?
The example code in this repo's README shows blueprints being produced with Python's `zlib.compress` (not gzip), so `zlib.inflate` is the primary correct inverse. `gunzip` and `inflateRaw` are provided as fallbacks because some blueprint sources use different wrappers.

### Footprint & ASCII rendering rules (for `scripts/blueprint-ascii.ts`)
- Entity sizes: the renderer maintains a small size map for common entities. By default:
  - `boiler`: 3 × 2 tiles
  - `steam-engine`: 3 × 5 tiles
  - `small-electric-pole`: 1 × 1
  - `inserter`: 1 × 1
  - `pipe`: 1 × 1
  - `transport-belt`: 1 × 1
- Character mapping (defaults in the script):
  - `B` = boiler (uppercase for multi-tile entities)
  - `S` = steam engine
  - `b` = belt
  - `e` = small electric pole
  - `i` = inserter
  - `p` = pipe
  - `?` = unknown entity

Placement algorithm
- Each entity's continuous footprint is computed from its center position (x, y) and its width/height: left = x - w/2, right = x + w/2. The integer tile coverage is calculated as:
  - xStart = floor(left)
  - xEnd = ceil(right) - 1
  - same for yStart/yEnd
- This approach ensures exact adjacency between multiblock and 1×1 entities (no artificial 1-tile gaps caused by naive rounding).

Overlap resolution
- Each entity type has a priority number; higher priorities overwrite lower priorities. Current defaults (can be tuned in `scripts/blueprint-ascii.ts`):
  - `steam-engine`: 5
  - `boiler`: 4
  - `small-electric-pole`: 3
  - `inserter`: 2
  - `pipe`: 1
- Rules:
  - If incoming entity priority > existing cell priority: overwrite.
  - If incoming priority < existing: ignore incoming.
  - If equal priority:
    - If the cell is empty (priority 0) the incoming places.
    - Otherwise prefer uppercase multi-tile characters (B/S) over lowercase; if neither is preferred, the cell becomes `+` indicating a conflict.

This heuristics produces readable ASCII maps and prefers visual clarity (multiblock entities dominate) while signaling true conflicts with `+`.

### CLI usage
- Decode a blueprint .bp into JSON:
```bash
npm run decode-bp -- path/to/blueprint.bp
```
Produces `path/to/blueprint.json` by default.

- Render ASCII from a decoded JSON:
```bash
npm run bp-ascii -- path/to/blueprint.json
```
The command prints an ASCII map to stdout. Use shell redirection to capture it in a file.

### Debugging and tips
- If you get binary-looking output in the JSON file, check that the decoder stripped the leading prefix (it strips `0`/`1`). If your blueprint uses a different prefix, remove it manually or update the decoder.
- If entities overlap incorrectly after rotation tests, try enabling the footprints debug output in `scripts/blueprint-ascii.ts` (there is a JSON debug dump printed to stderr) to inspect computed `xStart`/`xEnd`/`yStart`/`yEnd` values.
- For best fidelity, add more entity sizes and oriented collision boxes to `SIZE_MAP` in the ASCII renderer. If you want, I can add a curated set of sizes for common Factorio entities.

### Implementation notes
- The TypeScript tools use Node ESM and `ts-node/esm` for convenience. If your environment lacks types, install dev dependencies:
```bash
npm install --save-dev ts-node @types/node typescript
```
- The repository `tsconfig.json` includes `"types": ["node"]` to help the TypeScript compiler find Node types.

### Next steps (suggested)
- Add a `--debug` flag to the ASCII renderer to toggle coordinate and footprint logging.
- Add more entity definitions (offshore-pump, inserter arms/directions, poles with reach) so the ASCII map more closely mirrors in-game visuals.
- Add a wrapper npm script that runs decode + ascii in one command.

If you'd like I can add any of the next steps above; tell me which and I'll implement them and run the rotated blueprint test once you add the rotated `.bp` file.
