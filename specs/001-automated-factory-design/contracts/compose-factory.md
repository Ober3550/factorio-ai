# Tool Contract: compose-factory

**Purpose**: Automatically compose a factory block from blueprints to meet production requirements, positioning modules to avoid overlaps and align I/O connections.

**Addresses**: User Story 3 (P3), FR-008, FR-009, FR-010, FR-011, FR-012, FR-017, FR-018

---

## CLI Signature

```bash
node --loader ts-node/esm scripts/compose-factory.ts \
  --requirements <path-to-requirements.json> \
  [--name <factory-name>] \
  [--algorithm <greedy|optimal>] \
  [--max-width <tiles>] \
  [--max-height <tiles>] \
  [--output <file-path>] \
  [--visualize] \
  [--json] \
  [--quiet]
```

---

## Arguments

### Required

- `--requirements <path>`: Path to ProductionRequirement JSON file (from calculate-requirements)

### Optional

- `--name <string>`: Factory block name (default: auto-generated from target item)
- `--algorithm <type>`: Composition algorithm (default: `greedy`)
  - `greedy`: Fast, positions modules left-to-right based on dependencies
  - `optimal`: Slower, tries multiple layouts for best alignment (future enhancement)
- `--max-width <number>`: Maximum factory width in tiles (default: unlimited)
- `--max-height <number>`: Maximum factory height in tiles (default: unlimited)
- `--output <path>`: Save FactoryBlock JSON to file (default: stdout)
- `--visualize`: Generate ASCII visualization of composed factory
- `--json`: Output JSON only (suppress human-readable)
- `--quiet`: Suppress progress messages

---

## Composition Algorithm

### Greedy Algorithm (default)

1. **Load Requirements**: Parse ProductionRequirement to get machine counts
2. **Select Blueprints**: For each required machine type:
   - Search catalog for blueprints producing that item
   - If multiple blueprints exist, prefer higher efficiency (throughput/area)
   - If throughput < required, place multiple instances
3. **Topological Sort**: Order blueprints by dependency chain (raw materials → intermediates → final product)
4. **Position Modules**: 
   - Place first module at (0, 0)
   - For each subsequent module:
     - Find upstream module that produces required input
     - Position to right of upstream, aligning output → input positions
     - Add padding (2 tiles) for belt routing space
5. **Calculate Dimensions**: Bounding box of all positioned modules
6. **Generate Metadata**: Aggregate inputs/outputs, internal connections

### Optimal Algorithm (future)

- Tries multiple layout configurations (vertical, horizontal, grid)
- Scores each by alignment quality and total area
- Returns best layout

---

## Output Format

### Human-Readable (default)

```
Factory Block: Automation Science 60/min
=========================================
Target: 60/min automation-science-pack
Dimensions: 90 x 25 tiles
Modules: 4
Alignment Score: 0.95

Modules:
  1. smelting-iron-2col at (0, 0)
  2. smelting-copper-1col at (0, 15)
  3. gear-production at (30, 0)
  4. science-assembly at (60, 0)

External Inputs:
  - 90/min iron-ore at (0, 6)
  - 45/min copper-ore at (0, 20)

External Outputs:
  - 60/min automation-science-pack at (89, 12)

Internal Connections: 2
  iron-plate: smelting-iron-2col -> gear-production
  iron-gear-wheel: gear-production -> science-assembly

Efficiency: 0.0267 items/tile
Saved to: factory-designs/automation-science-60pm.json
```

### JSON (--json flag)

Full FactoryBlock structure as defined in data-model.md (see example there)

### Visualization (--visualize flag)

```
Factory Block ASCII Visualization:
===================================

    0         10        20        30        40        50        60        70        80        90
  0 ┌────────────────────────┐                ┌──────────┐                ┌──────────────────┐
    │                        │                │          │                │                  │
    │   Smelting (Iron)      │                │  Gear    │                │  Science Assy    │
    │                        │->iron-plate--->│  Prod    │->gear-wheel--->│                  │
  5 │   Input: iron-ore      │                │          │                │                  │
    │                        │                └──────────┘                │  Output: science │
    └────────────────────────┘                                            └──────────────────┘
    
 15 ┌──────────────┐
    │              │
    │  Smelting    │
    │  (Copper)    │
 20 │  Input:      │
    │  copper-ore  │
    └──────────────┘
```

---

## Composition Rules

### Blueprint Selection Criteria

1. **Recipe Match**: Blueprint must produce required item
2. **Throughput**: Single blueprint or multiple instances meet requirement
3. **Efficiency**: Prefer higher throughput/area ratio
4. **Availability**: Blueprint must be in catalog

### Positioning Constraints

1. **No Overlaps**: Modules cannot overlap spatially
2. **Alignment**: Output positions should align with input positions (±2 tiles tolerance)
3. **Distance**: Prefer minimal distance between connected modules
4. **Bounds**: Respect --max-width and --max-height if specified

### Connection Rules

1. **Resource Match**: Connection only if output resource = input resource
2. **Throughput**: Connection throughput = min(output rate, input rate)
3. **Direct**: Prefer direct connections (aligned I/O) over diagonal

---

## Error Handling

### Exit Codes

- `0`: Success
- `1`: Invalid arguments
- `2`: Requirements file not found or invalid
- `3`: No suitable blueprints found in catalog
- `4`: Cannot fit modules within max dimensions
- `5`: File system error (cannot write output)

### Error Examples

```
Error: No blueprint found producing 'iron-gear-wheel'
Suggestion: Add gear production blueprint to catalog with catalog-blueprint add
```

```
Error: Cannot fit 4 modules within max dimensions 50x50
Current layout requires 90x25 tiles
Suggestion: Increase --max-width or use smaller blueprints
```

```
Error: Circular dependency detected: lubricant -> advanced-oil-processing -> lubricant
Suggestion: Check production requirements or manually break cycle
```

---

## Performance Requirements

- Composition < 10 seconds (SC-003)
- 95% alignment success (SC-007)
- Handles up to 10-level deep production chains (SC-005)

---

## Dependencies

- `catalog-blueprint`: Must be able to search catalog
- Blueprint catalog must be populated with relevant blueprints

---

## Example Usage

### Basic Composition

```bash
# First, calculate requirements
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item automation-science-pack \
  --rate 60 \
  --output requirements.json \
  --json

# Then, compose factory
node --loader ts-node/esm scripts/compose-factory.ts \
  --requirements requirements.json \
  --name "Automation Science 60/min" \
  --output factory-designs/automation-60pm.json \
  --visualize
```

### With Constraints

```bash
node --loader ts-node/esm scripts/compose-factory.ts \
  --requirements requirements.json \
  --max-width 100 \
  --max-height 50 \
  --algorithm greedy \
  --output factory-compact.json
```

### JSON Pipeline

```bash
# AI-friendly: pure JSON pipeline
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item chemical-science-pack \
  --rate 45 \
  --json | \
node --loader ts-node/esm scripts/compose-factory.ts \
  --requirements /dev/stdin \
  --json > factory.json
```

---

## Testing Strategy

### Unit Tests
- Blueprint selection logic
- Positioning algorithm (overlap detection)
- Alignment score calculation
- Topological sort for dependencies

### Integration Tests
- Compose factory for each science pack type
- Multi-instance blueprint placement (when single blueprint insufficient)
- Deep production chains (5+ levels)
- Golden file comparison: expected FactoryBlock outputs

### Test Fixtures
```
blueprints/compose-test/
├── automation-science-60pm.requirements.json    # Input
├── automation-science-60pm.expected.json        # Expected FactoryBlock
└── automation-science-60pm.ascii                # Expected visualization
```

---

## AI Agent Support

**Questions this tool answers**:
- "How do I arrange blueprints to produce X items/min?"
- "What are the input/output positions for this factory?"
- "How much space does this factory need?"
- "What belts need to be routed internally?"

**AI Invocation Pattern**:
```typescript
// AI orchestration
const requirements = await runTool('calculate-requirements', {...})
const factory = await runTool('compose-factory', {
  requirements: requirements,
  json: true
})

// Use factory.externalInputs to route resource belts
// Use factory.internalConnections to route internal belts (separate tool)
```

---

## Future Enhancements

1. **Rotation Support**: Rotate blueprints 90/180/270° to improve alignment
2. **Optimal Algorithm**: Try multiple layouts, score by compactness + alignment
3. **Power Grid**: Calculate power requirements and suggest locations for power poles
4. **Beacons**: Place beacon modules near production buildings for productivity bonuses
