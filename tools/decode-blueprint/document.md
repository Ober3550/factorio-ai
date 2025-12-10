# Blueprint Decoder

## Overview
Decompresses Factorio blueprint strings (`.bp` format) into readable JSON for inspection and processing.

## Purpose
Factorio blueprints are distributed as base64-encoded, zlib-compressed JSON. This tool decodes them into editable JSON format so they can be analyzed, modified, and re-encoded.

## Usage

```bash
npm run decode-bp <input.bp> [output.json]
```

### Arguments
- `input.bp` - Path to blueprint file (or blueprint string in a text file)
- `output.json` - Optional output path. Defaults to same directory with `.json` extension

## Examples

```bash
# Decode to same directory
npm run decode-bp blueprints/smelting/smelting.bp

# Decode to specific file
npm run decode-bp blueprints/smelting/smelting.bp decoded.json
```

## Helper Script: run-and-ascii.ts

The `run-and-ascii.ts` script combines decoding with ASCII rendering:

```bash
node --loader ts-node/esm tools/decode-blueprint/run-and-ascii.ts <input.bp>
```

This automatically decodes the blueprint and then renders it as ASCII art in one step.

## Notes
- Handles multiple zlib compression methods (deflate, raw)
- Strips leading '0' or '1' prefix character if present
- Sets default direction (north/0) for inserters and belts if not specified
- Output is formatted JSON with proper indentation for readability
