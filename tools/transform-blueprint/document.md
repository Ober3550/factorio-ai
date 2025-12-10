# Blueprint Transformer

## Overview
Applies geometric transformations (rotation, flipping) to blueprints, useful for creating variants and testing layout symmetry.

## Purpose
Transforms a blueprint by rotating and/or flipping it around the origin, with automatic handling of entity directions and positions. Useful for creating mirrored smelting arrays or testing blueprint orientations.

## Usage

```bash
npm run transform-bp <input.json> [options]
```

### Options
- `--rotate N` - Rotate clockwise by N * 90° (0-3)
- `--flip-x` - Flip horizontally around Y axis
- `--flip-y` - Flip vertically around X axis
- `--strip-entity-numbers` - Remove entity_number values to avoid collisions during composition
- `--out, -o <file>` - Output file path

## Examples

```bash
# Rotate 90° clockwise
npm run transform-bp blueprints/test.json --rotate 1 --out rotated.json

# Flip horizontally
npm run transform-bp blueprints/test.json --flip-x --out flipped.json

# Rotate 180° and flip
npm run transform-bp blueprints/test.json --rotate 2 --flip-y --out transformed.json
```

## Features
- Automatically infers missing inserter directions based on adjacent furnaces
- Snaps positions to half-tile increments to avoid floating-point errors
- Displays 2x zoom ASCII preview after transformation
- Preserves entity metadata while updating positions and directions

## Notes
- Entity directions are properly rotated (north/east/south/west mappings)
- Entity positions are rotated around the origin (0, 0)
- Use `--strip-entity-numbers` when planning to compose transformed blueprints
