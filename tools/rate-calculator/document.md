# Rate Calculator

## Overview
Analyzes blueprint entities to calculate production rates, throughput requirements, and resource flow in items per minute.

## Purpose
Determines how many belts, inserters, and fuel are needed to support a blueprint's production. Replicates Factorio's in-game rate calculator tool for furnaces, assembly machines, and various recipes.

## Usage

```bash
npm run rate-calc <blueprint.json> [options]
```

### Options
- `--belt-type TYPE` - Belt type (default: transport-belt)
- `--inserter-type TYPE` - Inserter type (default: inserter)
- `--research` - Show max research stack rates
- `--json` - Output as JSON instead of formatted text

## Examples

```bash
# Analyze furnaces with default (base) speeds
npm run rate-calc blueprints/smelting/smelting.json

# Show with fast inserters
npm run rate-calc blueprints/smelting/smelting.json --inserter-type fast-inserter

# Output as JSON for scripting
npm run rate-calc blueprints/smelting/smelting.json --json
```

## Supported Types
- **Belts**: transport-belt, fast-transport-belt, express-transport-belt, turbo-transport-belt
- **Inserters**: inserter, fast-inserter, stack-inserter, bulk-inserter, long-handed-inserter, burner-inserter

## Features
- Calculates furnace production rates (18.75 items/min per furnace)
- Determines belt lane requirements for throughput
- Calculates inserter stack transfer rates
- Handles assembly machines with recipe-specific crafting times
- Shows fuel consumption for smelting operations
- Supports both base and max research stack sizes

## Helper Scripts

### compare.ts
Compares actual rate calculator output against expected values:

```bash
node --loader ts-node/esm tools/rate-calculator/compare.ts
```

## Notes
- Default furnace smelting time: 3.2 seconds per item
- Belt speeds: base=15, fast=30, express=45, turbo=60 items/second
- Inserter swing times vary by type (26-80 ticks)
- Recipes are configurable in the script for custom items
