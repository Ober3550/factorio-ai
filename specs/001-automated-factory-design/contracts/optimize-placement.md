# Tool Contract: optimize-placement

**Purpose**: Optimize factory block placement based on resource source locations to minimize belt routing distance.

**Addresses**: User Story 4 (P4), FR-013, FR-014, FR-015

---

## CLI Signature

```bash
node --loader ts-node/esm scripts/optimize-placement.ts \
  --factory <path-to-factory.json> \
  --resources <path-to-resources.json> \
  [--output <file-path>] \
  [--algorithm <nearest|centroid|balanced>] \
  [--json] \
  [--quiet]
```

---

## Arguments

### Required

- `--factory <path>`: Path to FactoryBlock JSON file (from compose-factory)
- `--resources <path>`: Path to ResourceSource[] JSON file (user-provided map)

### Optional

- `--output <path>`: Save optimized FactoryBlock JSON (default: stdout)
- `--algorithm <type>`: Optimization algorithm (default: `centroid`)
  - `nearest`: Position factory near single most-needed resource
  - `centroid`: Position at weighted centroid of all required resources
  - `balanced`: Minimize max distance to any required resource
- `--json`: Output JSON only
- `--quiet`: Suppress progress messages

---

## Input: Resource Map Format

**File**: JSON array of ResourceSource objects

**Example** (`resources.json`):
```json
[
  {
    "resource": "iron-ore",
    "position": { "x": 100, "y": 200 },
    "estimatedYield": 500000,
    "name": "Main Iron Patch"
  },
  {
    "resource": "copper-ore",
    "position": { "x": 150, "y": 180 },
    "estimatedYield": 300000,
    "name": "Main Copper Patch"
  },
  {
    "resource": "coal",
    "position": { "x": 120, "y": 250 },
    "estimatedYield": 200000,
    "name": "Coal Patch North"
  }
]
```

---

## Optimization Algorithms

### Nearest (Single Resource Focus)

1. Identify resource with highest consumption rate from factory.externalInputs
2. Position factory directly adjacent to that resource patch
3. Best for: Single-resource factories (e.g., pure smelting)

### Centroid (Weighted Center, default)

1. Calculate weighted centroid:
   - Weight = consumption rate from factory.externalInputs
   - Centroid = Σ(resource.position * weight) / Σ(weight)
2. Position factory centered at centroid
3. Best for: Multi-resource factories with balanced consumption

### Balanced (Minimax Distance)

1. Try multiple candidate positions near each resource
2. For each candidate, calculate max distance to any required resource
3. Choose position minimizing the maximum distance
4. Best for: Factories where all resources are equally critical

---

## Output Format

### Human-Readable (default)

```
Placement Optimization for: Automation Science 60/min
======================================================
Algorithm: centroid

Required Resources:
  - 90/min iron-ore
  - 45/min copper-ore

Resource Locations:
  - iron-ore at (100, 200) [Main Iron Patch]
  - copper-ore at (150, 180) [Main Copper Patch]

Optimal Factory Position: (115, 195)
  (Factory origin at this coordinate)

Routing Distances:
  - iron-ore (100, 200) -> Factory input (115, 201): 15.03 tiles
  - copper-ore (150, 180) -> Factory input (115, 210): 43.59 tiles

Total Belt Distance: 58.62 tiles
Average Distance: 29.31 tiles

Belt Routing Metadata:
  1. Route: iron-ore patch -> factory input
     From: (100, 200)
     To: (115, 201)
     Resource: iron-ore
     Throughput: 90/min
     
  2. Route: copper-ore patch -> factory input
     From: (150, 180)
     To: (115, 210)
     Resource: copper-ore
     Throughput: 45/min

Saved to: factory-designs/automation-60pm-placed.json
```

### JSON (--json flag)

**Updated FactoryBlock** with:
- `globalPosition`: Factory origin coordinates
- `routingMetadata`: Belt routing instructions

```json
{
  ...existing FactoryBlock fields...,
  "globalPosition": { "x": 115, "y": 195 },
  "routingMetadata": {
    "algorithm": "centroid",
    "totalDistance": 58.62,
    "routes": [
      {
        "from": { "x": 100, "y": 200, "type": "resource", "resource": "iron-ore", "sourceName": "Main Iron Patch" },
        "to": { "x": 115, "y": 201, "type": "factory-input", "moduleId": "smelting-iron-2col" },
        "resource": "iron-ore",
        "throughput": 90,
        "distance": 15.03
      },
      {
        "from": { "x": 150, "y": 180, "type": "resource", "resource": "copper-ore", "sourceName": "Main Copper Patch" },
        "to": { "x": 115, "y": 210, "type": "factory-input", "moduleId": "smelting-copper-1col" },
        "resource": "copper-ore",
        "throughput": 45,
        "distance": 43.59
      }
    ]
  }
}
```

---

## Routing Metadata Structure

**Purpose**: Provide complete information for external belt routing script

**Fields per Route**:
- `from`: Source location (resource patch coordinates)
- `to`: Destination location (factory input coordinates, adjusted for globalPosition)
- `resource`: Resource being transported
- `throughput`: Required items per minute
- `distance`: Euclidean distance in tiles

**Note**: This tool does NOT perform belt routing (pathfinding). It only calculates optimal placement and provides start/end coordinates for a separate routing tool.

---

## Error Handling

### Exit Codes

- `0`: Success
- `1`: Invalid arguments
- `2`: Factory file not found or invalid
- `3`: Resources file not found or invalid
- `4`: Missing required resource in resource map
- `5`: File system error

### Error Examples

```
Error: Factory requires 'iron-ore' but resource map does not include it
Available resources: copper-ore, coal
Suggestion: Add iron-ore location to resource map
```

```
Error: Invalid factory position (NaN, NaN) calculated
Cause: All resource weights are zero (no external inputs?)
```

---

## Performance Requirements

- Optimization < 5 seconds for typical factory (4-10 modules, 2-5 resource types)
- Scales linearly with number of resource sources

---

## Dependencies

- None (standalone tool, operates on JSON files)

---

## Example Usage

### Basic Optimization

```bash
# Create resource map
cat > resources.json << EOF
[
  {"resource": "iron-ore", "position": {"x": 100, "y": 200}},
  {"resource": "copper-ore", "position": {"x": 150, "y": 180}}
]
EOF

# Optimize placement
node --loader ts-node/esm scripts/optimize-placement.ts \
  --factory factory-designs/automation-60pm.json \
  --resources resources.json \
  --output factory-designs/automation-60pm-placed.json
```

### Try Different Algorithms

```bash
# Nearest: Position near iron (highest consumption)
node --loader ts-node/esm scripts/optimize-placement.ts \
  --factory factory.json \
  --resources resources.json \
  --algorithm nearest \
  --json > placed-nearest.json

# Balanced: Minimize maximum distance
node --loader ts-node/esm scripts/optimize-placement.ts \
  --factory factory.json \
  --resources resources.json \
  --algorithm balanced \
  --json > placed-balanced.json
```

### Full Pipeline

```bash
# Calculate -> Compose -> Optimize
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item automation-science-pack --rate 60 --json \
| node --loader ts-node/esm scripts/compose-factory.ts \
  --requirements /dev/stdin --json \
| node --loader ts-node/esm scripts/optimize-placement.ts \
  --factory /dev/stdin \
  --resources resources.json \
  --json > final-factory.json
```

---

## Testing Strategy

### Unit Tests
- Centroid calculation with weighted positions
- Distance calculation (Euclidean)
- Resource matching (factory.externalInputs vs resource map)

### Integration Tests
- Optimize placement for each algorithm
- Multi-resource scenarios (2, 3, 5 resource types)
- Edge cases: single resource, all resources at same location
- Golden file comparison: expected placement results

### Test Fixtures
```
blueprints/placement-test/
├── factory-automation-60pm.json        # Input FactoryBlock
├── resources-basic.json                # Input ResourceSource[]
├── expected-centroid.json              # Expected output (centroid algorithm)
└── expected-balanced.json              # Expected output (balanced algorithm)
```

---

## AI Agent Support

**Questions this tool answers**:
- "Where should I build this factory on my map?"
- "What belt routes do I need from resources to factory?"
- "How far are my resources from the factory?"
- "Which algorithm gives the shortest total routing distance?"

**AI Invocation Pattern**:
```typescript
// AI orchestration
const placedFactory = await runTool('optimize-placement', {
  factory: composedFactory,
  resources: userProvidedMap,
  algorithm: 'centroid',
  json: true
})

// Extract routing instructions
const routes = placedFactory.routingMetadata.routes
// Pass to belt routing tool (separate, out of scope)
```

---

## Coordinate System

**Factory Coordinates**: Relative to factory origin (0, 0) = top-left of bounding box

**Global Coordinates**: Map coordinates after applying `globalPosition` offset

**Conversion**: 
```
globalCoord = factoryCoord + globalPosition
```

**Example**:
- Factory input at relative position (0, 6)
- Factory globalPosition = (115, 195)
- Input global coordinates = (115, 201)

---

## Future Enhancements

1. **Obstacle Avoidance**: Factor in existing buildings, water, cliffs
2. **Belt Cost**: Optimize for belt item cost, not just distance
3. **Train Support**: Suggest train routes for distant resources (> 500 tiles)
4. **Multi-Factory**: Optimize placement of multiple factories simultaneously
