# Blueprint Composer

## Overview
Tiles a single blueprint unit into a grid pattern with optional transforms, creating larger factory layouts from modular designs.

## Purpose
Takes a blueprint and replicates it across rows and columns with automatic deduplication, proper spacing, and power pole network generation. Essential for scaling up modular designs.

## Usage

```bash
npm run compose-bp <input.json> --cols N --rows M [options] --out output.json
```

### Required Arguments
- `input.json` - Blueprint to compose
- `--cols N` - Number of columns
- `--rows M` - Number of rows

### Options
- `--spacing-x S` - Horizontal spacing between tiles (default: 1)
- `--spacing-y S` - Vertical spacing between tiles (default: 1)
- `--rotate N` - Rotate all tiles (0-3)
- `--flip-x` - Flip all tiles horizontally
- `--flip-y` - Flip all tiles vertically
- `--no-normalize` - Don't normalize input blueprint to start at (0,0)
- `--share-x` - Share edge along X axis (reduce spacing by 1 tile)
- `--share-y` - Share edge along Y axis (reduce spacing by 1 tile)
- `--rotate-bottom` - Flip bottom rows vertically for symmetric layouts
- `--flip-row N` - Flip specific row vertically
- `--rotate-row N:R` - Rotate specific row by R steps
- `--preview` - Show preview (note: automatic 2x zoom shown regardless)

## Examples

```bash
# Create 2x3 grid
npm run compose-bp blueprints/smelting.json --cols 2 --rows 3 --out smelting_2x3.json

# Create with edge sharing for belt continuity
npm run compose-bp blueprints/smelting.json --cols 2 --rows 2 --share-x --share-y --out smelting_compact.json

# Symmetric layout with bottom row flipped
npm run compose-bp blueprints/smelting.json --cols 3 --rows 2 --rotate-bottom --out smelting_symmetric.json
```

## Features
- Automatic deduplication of shared entities at tile edges
- Intelligent power pole network generation (connects within 7-tile range)
- Proper entity numbering for in-game import
- Automatic inserter direction correction to face furnaces
- Preserves blueprint metadata (icons, labels, version)
- Generates 2x zoom ASCII preview of result

## Notes
- Input blueprint is normalized to (0,0) unless `--no-normalize` specified
- Entities with matching name, position, and direction are deduplicated
- Power network connects poles in grid pattern (horizontal and vertical only)
- All positions are snapped to 0.5-tile increments to prevent floating-point errors
