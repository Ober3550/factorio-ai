# Blueprint Composition & Tools

This document describes how to compose small Factorio blueprint "units" into larger blueprints by tiling, flipping and rotating them. The repository includes a comprehensive toolset under `tools/` to help with decoding, rendering, composing, and analyzing blueprints.

## Tool Directory Structure

Each tool is organized in its own directory with documentation, tests, and supporting files:

```
tools/
├── blueprint-ascii/          Render blueprints as ASCII art
├── blueprint-metadata/       Extract entity statistics  
├── compose-blueprint/        Tile blueprints into grids
├── decode-blueprint/         Decompress .bp files to JSON
├── encode-blueprint/         Compress JSON to .bp format
├── rate-calculator/          Analyze production rates
└── transform-blueprint/      Rotate and flip blueprints
```

## Available Tools

### Core Tools

| Tool | Purpose | Docs |
|------|---------|------|
| **Blueprint Decoder** | Decompress Factorio `.bp` strings into editable JSON | [📖](tools/decode-blueprint/document.md) |
| **Blueprint Encoder** | Compress JSON blueprints into Factorio `.bp` format | [📖](tools/encode-blueprint/document.md) |
| **Blueprint ASCII** | Render blueprints as ASCII art for visual inspection | [📖](tools/blueprint-ascii/document.md) |
| **Blueprint Metadata** | Extract entity counts and statistics | [📖](tools/blueprint-metadata/document.md) |
| **Transform Blueprint** | Rotate and flip blueprints geometrically | [📖](tools/transform-blueprint/document.md) |
| **Compose Blueprint** | Tile blueprints into grids with deduplication | [📖](tools/compose-blueprint/document.md) |
| **Rate Calculator** | Analyze production rates and throughput | [📖](tools/rate-calculator/document.md) |

### Helper Scripts

- `tools/decode-blueprint/run-and-ascii.ts` — Decode and render in one step
- `tools/rate-calculator/compare.ts` — Compare calculated rates with expected values

### Data

- `data/recipes.json` — Database of entity speeds and recipe times used by flow calculations

## Visualizer

Depicted below are 6 furnaces fed by an input belt, inserters and an output belt. This is the first test example we're trying to use to get AI to compose larger designs and give it the tools to be able to design other builds.

```
<b<b<b<b<b<b<b<b<b<b<b<b
                        
  i i     i i     i i   
  v v  e  v v    ev v   
                        
 F F F F F F F F F F F F
                        
 F F F F F F F F F F F F
  i i     i i     i i   
  v v  e  v v    ev v   
<b<b<b<b<b<b<b<b<b<b<b<b
```

## Quickstart

### 1. Decode a Blueprint
Convert a Factorio `.bp` file to JSON:

```bash
npm run decode-bp blueprints/smelting/smelting.bp
```

**Output:**
```
Wrote decoded output to /Users/oliverm/Workspace/factorio-ai/blueprints/smelting/smelting.json
```

### 2. Inspect with ASCII Rendering
View the blueprint layout quickly:

```bash
npm run bp-ascii blueprints/smelting/smelting.json --zoom-2
```

**Output:**
```
   -7-6-5-4-3-2-10-9-8-7-6
-117 bbbbbbbbbbbb
-116 .iie.ii.eii.
-115 FFFFFFFFFFFF
-114 FFFFFFFFFFFF
-113 .iie.ii.eii.
-112 bbbbbbbbbbbb
```

Or do both in one step:

```bash
npm run decode-and-ascii blueprints/smelting/smelting.bp
```

### 3. Get Blueprint Statistics
Extract entity counts and metadata:

```bash
npm run bp-meta blueprints/smelting/smelting.json
```

**Output:**
```json
{
  "total_entities": 46,
  "furnaces": {
    "stone": 6,
    "total": 6
  },
  "inserters": 12,
  "belts": 24,
  "other_counts": {
    "small-electric-pole": 4
  }
}
```

### 4. Compose into a Grid
Tile a blueprint pattern into larger arrays:

```bash
npm run compose-bp blueprints/smelting/smelting.json --cols 3 --rows 3 --out assembled.json
```

**Output:** Creates a new JSON file with a 3×3 tiled layout of the blueprint pattern.

### 5. Transform Blueprints
Rotate or flip for variations:

```bash
npm run transform-bp blueprints/smelting/smelting.json --rotate 1 --out rotated.json
```

**Output:** Creates a rotated copy (90° clockwise rotation in this case).

### 6. Analyze Production
Calculate throughput requirements:

```bash
npm run rate-calc blueprints/smelting/smelting.json
```

(Note: This script is available after reorganization to `/tools/rate-calculator/`)

### 7. Encode Back to Blueprint Format
Convert JSON back to `.bp` for in-game import:

```bash
npm run encode-bp blueprints/smelting/smelting.json --out smelting.bp
```

**Output:**
```
0eJylmO2OoyAUhu/l/MaJIFjxVibNxjrshsRig3R3Jo33vrFmUmZi2/Nm/lFLHg4fj33phQ7D2Z2iD4naC/l+DBO1rxea/J/QDcuz0B0dtZRiF6bTGFNxcEOiWZAPb+6dWjmLje5TGoMrfp9j6HqX9VbzXpALySfv1pGuHz5+hfPx4CK1UtwZUdBpnHzyY1iGeae2MPWL
EfRBbSFl/WJmQW8+un7tItVS1ze4AuAGhVcAXKNwDcArFG4AuELhNQCXKHwHwEsU3vDh2qJwC8AbFC5LgL6D6YCjGnZUApJqWFJ5s9SHycXk4hM/zXduuYXVLKxBsTczp2M3DIUbXJ+i74vTOLgn7i8jbDFrVqklWuqOhZUotgFXIJfl3gpYTqm5F6xSVcnC1ihWoidWsbAKPbE87M2vrxFg6+f7k6y3dknpH5x9tb3zyvCr04+rgy3iLR9sEQ/b8OetHs/b/sDHO7tSlfzqyofVVSxXcrNZy1exXMnN5mH5rujm8bw1n/TYugrJgtmEJS8iI2FQw3QkDRqYDsTBPCUz6UAezF90PLoG8mD+zmLSkTubhOlIHmxgOnBry0M+kw5c2zRskwZczd95TDrgqn5i017QPx+vF/5XaYQRSguzF2tbNmu7WZ7ba3v5em3vBfnkjtRmf1QI+uvidGWbWlltrWlkZW2p5/k/hSNbCA==
```

## Workflow Example

1. Design or extract a small "unit" blueprint (e.g., a furnace array with belts and inserters).

2. Decode the `.bp` file:
```bash
npm run decode-bp blueprints/units/furnace-unit.bp
```

3. Check the layout visually:
```bash
npm run bp-ascii blueprints/units/furnace-unit.json --zoom-2
```

4. Compose into a larger array:
```bash
npm run compose-bp blueprints/units/furnace-unit.json \
  --cols 3 --rows 3 \
  --spacing-x 1 --spacing-y 1 \
  --out blueprints/assembled.json
```

5. Verify the result:
```bash
npm run bp-ascii blueprints/assembled.json --zoom-2
```

6. Calculate throughput:
```bash
npm run rate-calc blueprints/assembled.json
```

7. Encode for import:
```bash
npm run encode-bp blueprints/assembled.json --out factory.bp
```

8. Import `factory.bp` into Factorio!

## Compose Options

When creating grid layouts with `compose-bp`, use these options:

- `--cols N` — Columns in the grid
- `--rows M` — Rows in the grid
- `--spacing-x S` — Horizontal spacing between tiles (default: 1)
- `--spacing-y S` — Vertical spacing between tiles (default: 1)
- `--rotate R` — Rotate all tiles by R steps, 0-3 (each = 90° clockwise)
- `--flip-x` — Mirror all tiles horizontally
- `--flip-y` — Mirror all tiles vertically
- `--share-x` — Share edges along X axis (compact layouts)
- `--share-y` — Share edges along Y axis (compact layouts)
- `--rotate-bottom` — Flip bottom rows for symmetric designs
- `--no-normalize` — Don't shift unit to start at (0,0)

## Tips & Best Practices

- **Visual Verification** — Always use `npm run bp-ascii` after composing to verify alignment before importing.
- **Incremental Composition** — Build in small steps: test 2×2 grids first, then expand to larger arrays.
- **Edge Sharing** — Use `--share-x` and `--share-y` for compact layouts where tiles overlap by 1 tile.
- **Asymmetric Designs** — Use `--flip-row` and `--rotate-row` for per-row customization.
- **Transform First** — Apply `transform-bp` to create variations before composing.

## Testing & Verification

Run the test suites to verify tool functionality:

```bash
# Test ASCII rendering against golden files
npm run test-ascii

# Test blueprint transformations
npm run test-transform

# Test rate calculations
npm run test-rate
```

## Documentation

For detailed usage information on each tool, see:

- [Blueprint Decoder](tools/decode-blueprint/document.md) - Decompress `.bp` files
- [Blueprint Encoder](tools/encode-blueprint/document.md) - Compress to `.bp` format
- [Blueprint ASCII](tools/blueprint-ascii/document.md) - Visual rendering
- [Blueprint Metadata](tools/blueprint-metadata/document.md) - Extract statistics
- [Transform Blueprint](tools/transform-blueprint/document.md) - Geometric operations
- [Compose Blueprint](tools/compose-blueprint/document.md) - Grid tiling
- [Rate Calculator](tools/rate-calculator/document.md) - Throughput analysis

For more details on the repository structure and reorganization, see [TOOLS_STRUCTURE.md](TOOLS_STRUCTURE.md).

## Project Structure

```
factorio-ai/
├── blueprints/          Example blueprints and test cases
├── data/                Recipe and entity data
├── tools/               Main toolset directory
│   ├── blueprint-ascii/
│   ├── blueprint-metadata/
│   ├── compose-blueprint/
│   ├── decode-blueprint/
│   ├── encode-blueprint/
│   ├── rate-calculator/
│   └── transform-blueprint/
├── specs/               Specifications and design docs
├── BLUEPRINT_PROCESSING.md
├── TOOLS_STRUCTURE.md
└── README.md (this file)
```