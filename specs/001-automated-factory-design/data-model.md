# Data Models: Automated Factory Design System

**Date**: 2025-12-10  
**Phase**: 1 (Design)  
**Status**: Complete

## Overview

This document defines the data structures for the Automated Factory Design System. All entities are persisted as JSON files following the project's existing pattern.

---

## Core Entities

### 1. CalculatorConfig

**Purpose**: Input configuration for Kirk McDonald calculator query

**File Location**: Not persisted (ephemeral, used to build calculator URL)

**Schema**:
```typescript
interface CalculatorConfig {
  // Target items to produce
  items: Array<{
    name: string          // Factorio item ID (e.g., "automation-science-pack")
    rate: number          // Desired production rate
  }>
  
  // Time unit for rates
  rateUnit: 's' | 'm' | 'h'  // second, minute, hour
  
  // Technology levels (affects machine selection)
  technology: {
    assembler: string     // "assembling-machine-1" | "assembling-machine-2" | "assembling-machine-3"
    furnace: string       // "stone-furnace" | "steel-furnace" | "electric-furnace"
    miner: string         // "burner-mining-drill" | "electric-mining-drill"
    belt: string          // "transport-belt" | "fast-transport-belt" | "express-transport-belt"
  }
  
  // Factorio game version
  version: string         // e.g., "1.1", "1.2"
}
```

**Validation Rules**:
- `items`: Non-empty array, each `rate` > 0
- `rateUnit`: Must be one of `s`, `m`, `h`
- `technology` fields: Must match valid Factorio entity names
- `version`: Semantic version format

**Example**:
```json
{
  "items": [
    { "name": "automation-science-pack", "rate": 60 }
  ],
  "rateUnit": "m",
  "technology": {
    "assembler": "assembling-machine-2",
    "furnace": "electric-furnace",
    "miner": "electric-mining-drill",
    "belt": "fast-transport-belt"
  },
  "version": "1.1"
}
```

---

### 2. ProductionRequirement

**Purpose**: Output from calculator query; represents complete machine and resource requirements

**File Location**: `.factorio-cache/requirements/<hash>.json` (cached) or output of `calculate-requirements.ts`

**Schema**:
```typescript
interface ProductionRequirement {
  // Input specification
  targetItem: string        // Primary item being produced
  targetRate: number        // Desired production rate
  rateUnit: string          // 's' | 'm' | 'h'
  
  // Calculator metadata
  calculatorUrl: string     // Full URL for reproducibility
  factorioVersion: string   // Game version used
  
  // Machine requirements
  machines: Array<{
    type: string            // Machine entity ID (e.g., "assembling-machine-2")
    recipe: string          // Recipe being crafted (e.g., "iron-plate")
    count: number           // Number of machines needed (may be fractional)
  }>
  
  // Input resource requirements
  inputs: Array<{
    resource: string        // Resource entity ID (e.g., "iron-ore")
    rate: number            // Required input rate (units per rateUnit)
  }>
  
  // Production chain dependencies (intermediate products)
  dependencies: Array<{
    item: string            // Intermediate product (e.g., "iron-gear-wheel")
    rate: number            // Required production rate
  }>
  
  // Metadata
  timestamp: string         // ISO 8601 timestamp of calculation
  cacheKey: string          // SHA-256 hash of calculator URL (for cache lookup)
}
```

**Validation Rules**:
- `calculatorUrl`: Must be valid HTTPS URL starting with kirkmcdonald.github.io
- `machines[].count`: Non-negative number
- `inputs[].rate`: Positive number
- `timestamp`: Valid ISO 8601 format

**Example**:
```json
{
  "targetItem": "automation-science-pack",
  "targetRate": 60,
  "rateUnit": "m",
  "calculatorUrl": "https://kirkmcdonald.github.io/calc.html#items=automation-science-pack:r:60&rate=m&assembler=assembling-machine-2&furnace=electric-furnace",
  "factorioVersion": "1.1",
  "machines": [
    { "type": "assembling-machine-2", "recipe": "automation-science-pack", "count": 3.0 },
    { "type": "assembling-machine-2", "recipe": "iron-gear-wheel", "count": 1.5 },
    { "type": "electric-furnace", "recipe": "iron-plate", "count": 0.75 },
    { "type": "electric-furnace", "recipe": "copper-plate", "count": 0.5 }
  ],
  "inputs": [
    { "resource": "iron-ore", "rate": 90 },
    { "resource": "copper-ore", "rate": 45 }
  ],
  "dependencies": [
    { "item": "iron-gear-wheel", "rate": 30 },
    { "item": "iron-plate", "rate": 45 },
    { "item": "copper-plate", "rate": 30 }
  ],
  "timestamp": "2025-12-10T10:30:00Z",
  "cacheKey": "a3f2d8e1b4c7f9a2"
}
```

---

### 3. Blueprint

**Purpose**: Reusable factory module with spatial and throughput metadata

**File Location**: `blueprints/<name>/<name>.metadata.json` (alongside existing `.bp` and `.json` files)

**Schema**:
```typescript
interface Blueprint {
  // Identity
  id: string                // Unique identifier (UUID or slug)
  name: string              // Human-readable name
  
  // Blueprint data
  blueprintString: string   // Encoded Factorio blueprint (references .bp file path)
  blueprintJson: string     // Decoded JSON (references .json file path)
  
  // Spatial metadata
  dimensions: {
    width: number           // Tile width
    height: number          // Tile height
  }
  
  // Production metadata
  primaryOutput: {
    item: string            // Main product (e.g., "iron-plate")
    rate: number            // Items per minute
  }
  
  // Inputs (multiple allowed)
  inputs: Array<{
    resource: string        // Input resource (e.g., "iron-ore")
    rate: number            // Consumption rate (items per minute)
    position: {             // Tile coordinates for input belt connection
      x: number
      y: number
    }
  }>
  
  // Outputs (multiple allowed)
  outputs: Array<{
    resource: string        // Output resource
    rate: number            // Production rate (items per minute)
    position: {             // Tile coordinates for output belt connection
      x: number
      y: number
    }
  }>
  
  // Categorization
  tags: string[]            // e.g., ["smelting", "early-game", "4-column"]
  
  // Quality metrics
  efficiency: number        // Rate per tile area (calculated: primaryOutput.rate / (width * height))
  
  // Metadata
  createdAt: string         // ISO 8601 timestamp
  usageCount: number        // How many times used in compositions (increments on use)
  validated: boolean        // Whether blueprint passes validation tests
}
```

**Validation Rules**:
- `dimensions`: Width and height must be positive integers
- `inputs` and `outputs`: Positions must be within `[0, 0]` to `[width-1, height-1]`
- No overlapping input/output positions
- `efficiency`: Auto-calculated, read-only
- `blueprintString`: Path to existing `.bp` file
- `blueprintJson`: Path to existing `.json` file

**Example**:
```json
{
  "id": "smelting-4col-2row",
  "name": "Smelting Array (4 columns, 2 rows)",
  "blueprintString": "blueprints/smelting/smelting_4col_2row.bp",
  "blueprintJson": "blueprints/smelting/smelting_4col_2row.json",
  "dimensions": {
    "width": 24,
    "height": 12
  },
  "primaryOutput": {
    "item": "iron-plate",
    "rate": 180
  },
  "inputs": [
    { "resource": "iron-ore", "rate": 180, "position": { "x": 0, "y": 6 } }
  ],
  "outputs": [
    { "resource": "iron-plate", "rate": 180, "position": { "x": 23, "y": 6 } }
  ],
  "tags": ["smelting", "iron", "mid-game"],
  "efficiency": 0.625,
  "createdAt": "2025-12-10T10:00:00Z",
  "usageCount": 0,
  "validated": true
}
```

---

### 4. FactoryBlock

**Purpose**: Composed factory design from multiple positioned blueprints

**File Location**: Output of `compose-factory.ts`, user specifies output path

**Schema**:
```typescript
interface FactoryBlock {
  // Identity
  id: string                // Unique identifier for this composition
  name: string              // User-provided or auto-generated name
  
  // Target specification
  target: {
    item: string            // Target product
    rate: number            // Desired production rate
    rateUnit: string        // Time unit
  }
  
  // Composed blueprints
  modules: Array<{
    blueprintId: string     // Reference to Blueprint.id
    position: {             // Offset from factory block origin
      x: number
      y: number
    }
    rotation: number        // 0, 90, 180, 270 degrees (future: may support rotation)
    instance: number        // Instance number (1, 2, 3... if same blueprint used multiple times)
  }>
  
  // Overall dimensions
  dimensions: {
    width: number           // Total tile width
    height: number          // Total tile height
  }
  
  // Aggregate inputs (external inputs to entire factory block)
  externalInputs: Array<{
    resource: string        // Resource type
    rate: number            // Total consumption rate
    positions: Array<{      // May have multiple input points
      x: number             // Global tile coordinates (relative to factory block origin)
      y: number
      moduleId: string      // Which module this connects to
    }>
  }>
  
  // Aggregate outputs (external outputs from entire factory block)
  externalOutputs: Array<{
    resource: string        // Resource type
    rate: number            // Total production rate
    positions: Array<{      // May have multiple output points
      x: number             // Global tile coordinates
      y: number
      moduleId: string      // Which module this produces from
    }>
  }>
  
  // Belt routing metadata (for external routing script)
  internalConnections: Array<{
    from: {
      moduleId: string
      position: { x: number; y: number }
      resource: string
    }
    to: {
      moduleId: string
      position: { x: number; y: number }
      resource: string
    }
    requiredThroughput: number  // Items per minute
  }>
  
  // Quality metrics
  efficiency: number        // Total production rate / total area
  alignment Score: number   // 0.0 to 1.0 (how well inputs/outputs align, 1.0 = perfect)
  
  // Metadata
  createdAt: string
  productionRequirementRef: string  // Reference to ProductionRequirement that generated this
}
```

**Validation Rules**:
- No overlapping modules (spatial conflict detection)
- `dimensions`: Must contain all module positions + module dimensions
- `internalConnections`: `from.resource` must match `to.resource`
- `alignmentScore`: Calculated based on distance between connected module I/O points

**Example**:
```json
{
  "id": "factory-automation-science-60pm",
  "name": "Automation Science 60/min Factory",
  "target": {
    "item": "automation-science-pack",
    "rate": 60,
    "rateUnit": "m"
  },
  "modules": [
    { "blueprintId": "smelting-iron-2col", "position": { "x": 0, "y": 0 }, "rotation": 0, "instance": 1 },
    { "blueprintId": "smelting-copper-1col", "position": { "x": 0, "y": 15 }, "rotation": 0, "instance": 1 },
    { "blueprintId": "gear-production", "position": { "x": 30, "y": 0 }, "rotation": 0, "instance": 1 },
    { "blueprintId": "science-assembly", "position": { "x": 60, "y": 0 }, "rotation": 0, "instance": 1 }
  ],
  "dimensions": {
    "width": 90,
    "height": 25
  },
  "externalInputs": [
    {
      "resource": "iron-ore",
      "rate": 90,
      "positions": [{ "x": 0, "y": 6, "moduleId": "smelting-iron-2col" }]
    },
    {
      "resource": "copper-ore",
      "rate": 45,
      "positions": [{ "x": 0, "y": 20, "moduleId": "smelting-copper-1col" }]
    }
  ],
  "externalOutputs": [
    {
      "resource": "automation-science-pack",
      "rate": 60,
      "positions": [{ "x": 89, "y": 12, "moduleId": "science-assembly" }]
    }
  ],
  "internalConnections": [
    {
      "from": { "moduleId": "smelting-iron-2col", "position": { "x": 29, "y": 6 }, "resource": "iron-plate" },
      "to": { "moduleId": "gear-production", "position": { "x": 30, "y": 6 }, "resource": "iron-plate" },
      "requiredThroughput": 45
    },
    {
      "from": { "moduleId": "gear-production", "position": { "x": 59, "y": 8 }, "resource": "iron-gear-wheel" },
      "to": { "moduleId": "science-assembly", "position": { "x": 60, "y": 8 }, "resource": "iron-gear-wheel" },
      "requiredThroughput": 30
    }
  ],
  "efficiency": 0.0267,
  "alignmentScore": 0.95,
  "createdAt": "2025-12-10T11:00:00Z",
  "productionRequirementRef": ".factorio-cache/requirements/a3f2d8e1b4c7f9a2.json"
}
```

---

### 5. ResourceSource

**Purpose**: Map location of resource patches for proximity optimization

**File Location**: User-provided input (JSON file or CLI arguments)

**Schema**:
```typescript
interface ResourceSource {
  // Resource type
  resource: string          // e.g., "iron-ore", "copper-ore", "stone", "coal"
  
  // Map location
  position: {
    x: number               // Map X coordinate
    y: number               // Map Y coordinate
  }
  
  // Optional metadata
  estimatedYield?: number   // Total resource amount (if known)
  extractionRate?: number   // Current mining rate (if active)
  
  // Naming
  name?: string             // Optional user label (e.g., "North Iron Patch")
}
```

**Validation Rules**:
- `resource`: Must match Factorio resource entity ID
- `position`: Any valid map coordinates (can be negative)

**Example**:
```json
{
  "resource": "iron-ore",
  "position": { "x": 100, "y": 200 },
  "estimatedYield": 500000,
  "name": "Main Iron Patch"
}
```

---

## Relationships

```
CalculatorConfig -> (Selenium query) -> ProductionRequirement
ProductionRequirement -> (blueprint selection) -> Blueprint[]
Blueprint[] + ProductionRequirement -> (composition) -> FactoryBlock
ResourceSource[] + FactoryBlock -> (optimization) -> FactoryBlock (updated positions)
```

## File Storage Structure

```
.factorio-cache/
└── requirements/
    └── <cacheKey>.json     # ProductionRequirement (cached calculator results)

blueprints/
└── <blueprint-name>/
    ├── <name>.bp           # Existing: Encoded blueprint string
    ├── <name>.json         # Existing: Decoded blueprint JSON
    └── <name>.metadata.json  # NEW: Blueprint metadata

factory-designs/
└── <design-name>.json      # FactoryBlock outputs

resource-maps/
└── <map-name>.json         # ResourceSource[] user-provided maps
```

## Data Validation Utilities

Each entity will have a corresponding validation function in `src/models/`:

```typescript
// src/models/blueprint.ts
export function validateBlueprint(data: unknown): Blueprint | ValidationError
export function calculateEfficiency(blueprint: Blueprint): number

// src/models/production-requirement.ts
export function validateProductionRequirement(data: unknown): ProductionRequirement | ValidationError
export function getCacheKey(url: string): string

// src/models/factory-block.ts
export function validateFactoryBlock(data: unknown): FactoryBlock | ValidationError
export function detectSpatialConflicts(modules: FactoryBlock['modules'], blueprints: Map<string, Blueprint>): Conflict[]
export function calculateAlignmentScore(block: FactoryBlock, blueprints: Map<string, Blueprint>): number
```

## Next Steps

1. Implement TypeScript interfaces and validation functions in `src/models/`
2. Create test fixtures with sample data for each entity
3. Define CLI contracts in contracts/ directory
4. Implement persistence layer (JSON read/write utilities)
