# Blueprint composition

This document describes how to compose small Factorio blueprint "units" into larger blueprints by tiling, flipping and rotating them. The repository includes a small toolset under `scripts/` to help with decoding, rendering and composing blueprints.

Files of interest

- `scripts/compose-blueprint.ts` — Compose a blueprint JSON by repeating a unit in a grid, with optional spacing, rotation and flipping.
- `scripts/blueprint-ascii.ts` — Render a blueprint JSON to an ASCII grid for quick visual checks.
- `scripts/decode-blueprint.ts` — Decode a `.bp` blueprint string into pretty JSON.
- `data/recipes.json` — A small database of entity speeds and recipe times used by flow calculations.

Workflow

1. Design or extract a small "unit" blueprint that contains the transport belts, inserters and the producing/consuming entities (e.g. a furnace unit).
2. Decode the `.bp` file to JSON if necessary:

```bash
npm run decode-bp -- path/to/unit.bp
```

3. Compose the unit into a larger array:

```bash
npm run compose-bp -- path/to/unit.json --cols 3 --rows 3 --spacing-x 1 --spacing-y 1 --out blueprints/assembled.json
```

Options

- `--cols N` and `--rows M` — how many copies horizontally and vertically.
- `--spacing-x` / `--spacing-y` — extra spacing between tiled units.
- `--rotate R` — rotate each tile by R steps (0..3, each step = 90° clockwise).
- `--flip-x`, `--flip-y` — mirror the tile before placing.
- `--no-normalize` — if set, the unit won't be shifted so its minimum coordinates are at (0,0).

Tips

- Use `npm run bp-ascii` to render the composed blueprint and verify alignment before saving as a blueprint string.
- Compose in small steps: tile 2x2 first then expand to 4x4.
- If you need alternating rotations per tile (e.g. chaining direction), it's possible to extend `compose-blueprint.ts` to accept patterns or a JSON layout map.

Next steps

- Add a small generator to automatically compute how many units are needed to hit a throughput target (e.g. 7.5 items/s). This can use `scripts/blueprint-flow.ts` and a binary search over N/M.
- Export the composed JSON back to Factorio `.bp` format (we can add an encoder script).

