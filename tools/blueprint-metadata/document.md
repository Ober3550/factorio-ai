# Blueprint Metadata Extractor

## Overview
Extracts summary information about blueprint contents including entity counts organized by type.

## Purpose
Provides quick statistics about a blueprint's composition - how many furnaces, assemblers, belts, etc. without needing to view the full blueprint structure.

## Usage

```bash
npm run bp-meta <blueprint.json> [options]
```

### Options
- `--out, -o <file>` - Write metadata to a file instead of stdout

## Examples

```bash
# Display metadata to terminal
npm run bp-meta blueprints/smelting/smelting.json

# Save metadata to file
npm run bp-meta blueprints/smelting/smelting.json --out metadata.json
```

## Output Format
The metadata is output as JSON with the following structure:

```json
{
  "total_entities": 42,
  "boilers": 2,
  "steam_engines": 4,
  "furnaces": {
    "stone": 8,
    "total": 8
  },
  "assemblers": {
    "assembling-machine-1": 4,
    "assembling-machine-2": 2,
    "total": 6
  },
  "inserters": 12,
  "belts": 20,
  "pumps": 1,
  "other_counts": {}
}
```

## Notes
- Only counts entities that are explicitly configured in the script
- "Other counts" section lists any unrecognized entity types
- Useful for validating blueprint structure before processing
