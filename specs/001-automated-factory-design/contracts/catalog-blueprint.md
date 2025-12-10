# Tool Contract: catalog-blueprint

**Purpose**: Manage blueprint catalog (CRUD operations) with metadata about dimensions, throughput, and I/O positions.

**Addresses**: User Story 2 (P2), FR-004, FR-005, FR-006, FR-007, FR-016

---

## CLI Signature

```bash
# Add blueprint to catalog
node --loader ts-node/esm scripts/catalog-blueprint.ts add \
  --blueprint <path-to-.bp-file> \
  --name <human-readable-name> \
  --dimensions <width>x<height> \
  --primary-output <item>:<rate> \
  --input <resource>:<rate>:<x>,<y> \
  [--output <resource>:<rate>:<x>,<y>] \
  [--tag <tag>] \
  [--json]

# Search catalog
node --loader ts-node/esm scripts/catalog-blueprint.ts search \
  [--item <item-id>] \
  [--input <resource-id>] \
  [--min-throughput <number>] \
  [--max-dimensions <width>x<height>] \
  [--tag <tag>] \
  [--sort-by <field>] \
  [--json]

# Get blueprint details
node --loader ts-node/esm scripts/catalog-blueprint.ts get \
  --id <blueprint-id> \
  [--json]

# List all blueprints
node --loader ts-node/esm scripts/catalog-blueprint.ts list \
  [--json]

# Update blueprint metadata
node --loader ts-node/esm scripts/catalog-blueprint.ts update \
  --id <blueprint-id> \
  [--name <new-name>] \
  [--primary-output <item>:<rate>] \
  [--tag <tag>] \
  [--json]

# Delete blueprint
node --loader ts-node/esm scripts/catalog-blueprint.ts delete \
  --id <blueprint-id> \
  [--confirm]
```

---

## Commands

### `add` - Add Blueprint to Catalog

**Required Arguments**:
- `--blueprint <path>`: Path to `.bp` file
- `--name <string>`: Human-readable name
- `--dimensions <WxH>`: Width and height in tiles (e.g., `24x12`)
- `--primary-output <item:rate>`: Main product and rate (e.g., `iron-plate:180`)
- `--input <resource:rate:x,y>`: Input resource, rate, position (repeatable)

**Optional Arguments**:
- `--output <resource:rate:x,y>`: Additional outputs (repeatable, defaults to primary output)
- `--tag <string>`: Tag for categorization (repeatable)
- `--json`: Output JSON only

**Validation**:
- Blueprint file must exist and be valid
- Dimensions must be positive integers
- Input/output positions must be within `[0,0]` to `[width-1, height-1]`
- No overlapping input/output positions
- Rates must be positive numbers

**Output**:
```json
{
  "id": "smelting-4col-2row",
  "status": "added",
  "metadata": { ...Blueprint object... },
  "path": "blueprints/smelting/smelting_4col_2row.metadata.json"
}
```

---

### `search` - Search Catalog

**Optional Arguments** (all filters are AND logic):
- `--item <item-id>`: Filter by produced item
- `--input <resource-id>`: Filter by required input resource
- `--min-throughput <number>`: Minimum primary output rate
- `--max-dimensions <WxH>`: Maximum width x height
- `--tag <string>`: Filter by tag (repeatable for OR logic)
- `--sort-by <field>`: Sort results (options: `efficiency`, `throughput`, `size`, `name`)
- `--json`: Output JSON only

**Output (JSON)**:
```json
{
  "query": {
    "item": "iron-plate",
    "min-throughput": 100
  },
  "results": [
    {
      "id": "smelting-4col-2row",
      "name": "Smelting Array (4 columns, 2 rows)",
      "primaryOutput": { "item": "iron-plate", "rate": 180 },
      "dimensions": { "width": 24, "height": 12 },
      "efficiency": 0.625,
      "tags": ["smelting", "iron", "mid-game"]
    },
    ...
  ],
  "count": 3
}
```

**Output (human-readable)**:
```
Found 3 blueprints matching criteria:

1. smelting-4col-2row (Smelting Array, 4x2)
   Output: 180/min iron-plate
   Dimensions: 24x12 tiles
   Efficiency: 0.625/tile
   Tags: smelting, iron, mid-game

2. ...
```

---

### `get` - Get Blueprint Details

**Required Arguments**:
- `--id <blueprint-id>`: Blueprint identifier

**Output (JSON)**:
```json
{
  "id": "smelting-4col-2row",
  "name": "Smelting Array (4 columns, 2 rows)",
  "blueprintString": "blueprints/smelting/smelting_4col_2row.bp",
  "blueprintJson": "blueprints/smelting/smelting_4col_2row.json",
  "dimensions": { "width": 24, "height": 12 },
  "primaryOutput": { "item": "iron-plate", "rate": 180 },
  "inputs": [
    { "resource": "iron-ore", "rate": 180, "position": { "x": 0, "y": 6 } }
  ],
  "outputs": [
    { "resource": "iron-plate", "rate": 180, "position": { "x": 23, "y": 6 } }
  ],
  "tags": ["smelting", "iron", "mid-game"],
  "efficiency": 0.625,
  "createdAt": "2025-12-10T10:00:00Z",
  "usageCount": 5,
  "validated": true
}
```

---

### `list` - List All Blueprints

**Optional Arguments**:
- `--json`: Output JSON array

**Output**: Same format as `search` results

---

### `update` - Update Blueprint Metadata

**Required Arguments**:
- `--id <blueprint-id>`: Blueprint to update

**Optional Arguments** (at least one required):
- `--name <string>`: New name
- `--primary-output <item:rate>`: Update primary output
- `--tag <string>`: Add tag (repeatable)
- `--remove-tag <string>`: Remove tag
- `--json`: Output JSON only

**Note**: Dimensions, inputs, outputs cannot be updated (would require re-validation). Delete and re-add instead.

---

### `delete` - Delete Blueprint

**Required Arguments**:
- `--id <blueprint-id>`: Blueprint to delete
- `--confirm`: Safety flag (prevents accidental deletion)

**Output**:
```
Deleted blueprint: smelting-4col-2row
Metadata file removed: blueprints/smelting/smelting_4col_2row.metadata.json
Blueprint files (.bp, .json) preserved.
```

---

## Error Handling

### Exit Codes
- `0`: Success
- `1`: Invalid arguments
- `2`: Blueprint file not found or invalid
- `3`: Validation error (dimensions, positions, etc.)
- `4`: Blueprint ID not found (get, update, delete)
- `5`: File system error (cannot write metadata)

### Error Examples

```
Error: Input position (25, 6) exceeds blueprint dimensions (24x12)
```

```
Error: Overlapping input/output positions: (10, 5) used twice
```

```
Error: Blueprint ID 'invalid-id' not found in catalog
```

---

## Performance Requirements

- Search < 1 second for 1000 blueprints (SC-006)
- Lazy loading: Catalog loaded on first use, cached in memory
- Index rebuild on add/update

---

## Data Storage

```
blueprints/
└── <blueprint-name>/
    ├── <name>.bp              # Existing blueprint string
    ├── <name>.json            # Existing decoded blueprint
    └── <name>.metadata.json   # NEW: Blueprint metadata (this tool manages)
```

**Metadata File**: Blueprint struct as defined in data-model.md

---

## Example Usage

### Add Blueprint

```bash
node --loader ts-node/esm scripts/catalog-blueprint.ts add \
  --blueprint blueprints/smelting/smelting_4col_2row.bp \
  --name "Smelting Array (4 columns, 2 rows)" \
  --dimensions 24x12 \
  --primary-output iron-plate:180 \
  --input iron-ore:180:0,6 \
  --output iron-plate:180:23,6 \
  --tag smelting \
  --tag iron \
  --tag mid-game
```

### Search by Item and Throughput

```bash
node --loader ts-node/esm scripts/catalog-blueprint.ts search \
  --item iron-plate \
  --min-throughput 100 \
  --sort-by efficiency
```

### Get Blueprint Details

```bash
node --loader ts-node/esm scripts/catalog-blueprint.ts get \
  --id smelting-4col-2row \
  --json > smelting-details.json
```

---

## Testing Strategy

### Unit Tests
- Metadata validation (dimensions, positions)
- Efficiency calculation
- Search filtering and sorting logic

### Integration Tests
- Add blueprint with various configurations
- Search with multiple filter combinations
- Update and delete operations
- Golden file comparison for metadata structure

### Test Fixtures
```
blueprints/catalog-test/
├── test-blueprint.bp
├── test-blueprint.json
├── test-blueprint.metadata.json
└── test-blueprint.expected.json
```

---

## AI Agent Support

**Questions this tool answers**:
- "What blueprints produce iron plates?"
- "What is the most efficient smelting blueprint?"
- "What blueprints fit in a 20x20 area?"
- "Where are the input/output positions for blueprint X?"

**AI Invocation Pattern**:
```typescript
// Find blueprint matching requirements
const results = await runTool('catalog-blueprint', {
  command: 'search',
  item: 'iron-plate',
  minThroughput: 100,
  json: true
})

// Get detailed specifications for composition
const details = await runTool('catalog-blueprint', {
  command: 'get',
  id: results[0].id,
  json: true
})
```
