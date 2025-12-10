# Blueprint Encoder

## Overview
Compresses blueprint JSON into Factorio's native blueprint string format for in-game importing.

## Purpose
Takes a blueprint JSON file and encodes it into the compressed blueprint string format that Factorio understands, allowing blueprints to be shared and imported into the game.

## Usage

```bash
npm run encode-bp <blueprint.json> [options]
```

### Options
- `--out, -o <file>` - Write blueprint string to file instead of stdout
- `--pretty` - Pretty-print JSON before compression (for testing)

## Examples

```bash
# Output blueprint string to terminal
npm run encode-bp blueprints/smelting/smelting.json

# Save blueprint string to file
npm run encode-bp blueprints/smelting/smelting.json --out smelting.bp

# Generate with pretty JSON (for debugging)
npm run encode-bp blueprints/smelting/smelting.json --pretty
```

## Notes
- Automatically handles both bare blueprint objects and `{blueprint: {...}}` wrapper format
- Uses zlib deflate compression (matches Factorio's default)
- Adds '0' prefix character expected by Factorio
- Output includes newline for use in shell pipelines
