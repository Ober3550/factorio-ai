# Blueprint ASCII Renderer

## Overview
Converts Factorio blueprint JSON files into ASCII art representations for quick visual inspection of blueprint layouts.

## Purpose
This tool renders blueprint entities as ASCII characters to understand the spatial arrangement of machines, belts, and other infrastructure without needing to load the blueprint in-game.

## Usage

```bash
npm run bp-ascii <blueprint.json> [options]
```

### Options
- `--quiet, -q` - Suppress confirmation messages
- `--out, -o <file>` - Write output to a file instead of stdout
- `--zoom-2` - Use 2x2 density zoom for clearer visualization  
- `--zoom-3` - Use 3x3 density zoom with directional indicators
- `--zoom-1` - Output minimal grid (stable for golden file comparisons)
- `--debug` - Print debug information about entity footprints
- `--clean` - Output grid without coordinate labels

## Examples

```bash
# Display blueprint to terminal
npm run bp-ascii blueprints/smelting/smelting.json

# Save with 2x zoom to file
npm run bp-ascii blueprints/smelting/smelting.json --zoom-2 --out output.txt

# Quiet mode for scripting
npm run bp-ascii blueprints/smelting/smelting.json -q --out output.txt
```

## Character Map
- `B` - Boiler
- `S` - Steam engine
- `F` - Stone furnace
- `A` - Assembling machine
- `b` - Transport belt
- `i` - Inserter
- `e` - Electric pole
- `p` - Pipe
- `+` - Collision marker (overlapping entities)

## Notes
- Positions are snapped to tile coordinates for clarity
- Multi-tile entities are shown with their full footprint
- Priority determines which entity is shown when tiles overlap
- Golden files in `blueprints/*/golden_*.ascii` are used for regression testing
