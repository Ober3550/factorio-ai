# Tool Contract: calculate-requirements

**Purpose**: Query Kirk McDonald calculator via Selenium to determine machine and resource requirements for a target production rate.

**Addresses**: User Story 1 (P1), FR-001, FR-002, FR-003

---

## CLI Signature

```bash
node --no-warnings --loader ts-node/esm scripts/calculate-requirements.ts \
  --item <item-id> \
  --rate <number> \
  [--rate-unit <s|m|h>] \
  [--assembler <machine-type>] \
  [--furnace <furnace-type>] \
  [--miner <miner-type>] \
  [--belt <belt-type>] \
  [--version <factorio-version>] \
  [--no-cache] \
  [--clear-cache] \
  [--output <file-path>] \
  [--json] \
  [--quiet]
```

---

## Arguments

### Required

- `--item <item-id>`: Factorio item to produce (e.g., `automation-science-pack`)
- `--rate <number>`: Desired production rate (positive number)

### Optional

- `--rate-unit <s|m|h>`: Time unit for rate (default: `m` for per minute)
- `--assembler <machine-type>`: Assembler tier (default: `assembling-machine-2`)
- `--furnace <furnace-type>`: Furnace type (default: `electric-furnace`)
- `--miner <miner-type>`: Miner type (default: `electric-mining-drill`)
- `--belt <belt-type>`: Belt type (default: `fast-transport-belt`)
- `--version <factorio-version>`: Game version (default: `1.1`)
- `--no-cache`: Bypass cache, always query calculator
- `--clear-cache`: Delete cache entry for this configuration before querying
- `--output <file-path>`: Save result to file instead of stdout
- `--json`: Output JSON only (suppress human-readable format)
- `--quiet`: Suppress progress messages to stderr

---

## Output Format

### Human-Readable (default)

```
Production Requirements for automation-science-pack at 60/min
==============================================================
Calculator URL: https://kirkmcdonald.github.io/calc.html#items=...

Machines Required:
  - 3.0x assembling-machine-2 (automation-science-pack)
  - 1.5x assembling-machine-2 (iron-gear-wheel)
  - 0.75x electric-furnace (iron-plate)
  - 0.5x electric-furnace (copper-plate)

Input Resources:
  - 90/min iron-ore
  - 45/min copper-ore

Intermediate Products:
  - 30/min iron-gear-wheel
  - 45/min iron-plate
  - 30/min copper-plate

Cached: Yes (2025-12-10T10:30:00Z)
Cache Key: a3f2d8e1b4c7f9a2
```

### JSON (--json flag)

```json
{
  "targetItem": "automation-science-pack",
  "targetRate": 60,
  "rateUnit": "m",
  "calculatorUrl": "https://kirkmcdonald.github.io/calc.html#items=automation-science-pack:r:60&rate=m&assembler=assembling-machine-2&furnace=electric-furnace&miners=electric-mining-drill&belt=fast-transport-belt&version=1.1",
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

## Error Handling

### Exit Codes

- `0`: Success
- `1`: Invalid arguments (missing required, invalid format)
- `2`: Calculator unavailable (network error, timeout)
- `3`: Calculator parsing error (DOM structure changed)
- `4`: File system error (cannot write output/cache)

### Error Output (stderr)

```
Error: Calculator timeout after 10 seconds
URL: https://kirkmcdonald.github.io/calc.html#...
Suggestion: Check network connection or try again later
```

```
Error: Invalid item ID 'invalid-item'
Suggestion: Check against data/recipes.json for valid item names
```

---

## Caching Behavior

- Cache location: `.factorio-cache/requirements/<cacheKey>.json`
- Cache key: SHA-256 hash of calculator URL (first 16 chars)
- Default TTL: 7 days (604800 seconds)
- Cache hit: Skips Selenium, returns cached result in < 1 second
- Cache miss: Launches Selenium, queries calculator, caches result

**Cache Invalidation**:
- Automatic: After 7 days
- Manual: `--no-cache` (bypass) or `--clear-cache` (delete before query)
- User can inspect/delete `.factorio-cache/requirements/` directory

---

## Performance Requirements

- Cache hit: < 1 second (SC-001)
- Cache miss: < 5 seconds including Selenium launch (SC-001)
- Headless mode: Must work without display (CI/automation)

---

## Dependencies

- `selenium-webdriver`: Browser automation
- Selenium WebDriver binary (chromedriver, geckodriver) must be installed
- Internet connection required for calculator access

---

## Example Usage

### Basic Query

```bash
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item automation-science-pack \
  --rate 60
```

### Advanced Configuration

```bash
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item chemical-science-pack \
  --rate 45 \
  --rate-unit m \
  --assembler assembling-machine-3 \
  --furnace electric-furnace \
  --version 1.1 \
  --output requirements/chemical-science-45.json \
  --json
```

### Force Refresh

```bash
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item automation-science-pack \
  --rate 60 \
  --clear-cache
```

---

## Testing Strategy

### Unit Tests
- URL building from CalculatorConfig
- Cache key generation
- Cache hit/miss logic
- Output formatting (JSON and human-readable)

### Integration Tests
- Mock Selenium responses
- Full Selenium query against live calculator (slow, marked as e2e)
- Golden file comparison: expected outputs in `blueprints/calculator-test/`

### Test Fixtures
```
blueprints/calculator-test/
├── automation-science-60pm.config.json   # Input CalculatorConfig
├── automation-science-60pm.expected.json # Expected ProductionRequirement
└── chemical-science-45pm.config.json
```

---

## AI Agent Support

**Questions this tool answers**:
- "How many assemblers do I need for 60 science/min?"
- "What raw materials are required for production target X?"
- "What intermediate products do I need to produce?"
- "How do I reproduce these calculations?" (via saved calculator URL)

**AI Invocation Pattern**:
```typescript
// AI orchestration pseudocode
const requirements = await runTool('calculate-requirements', {
  item: 'automation-science-pack',
  rate: 60
})
// Parse JSON output, use requirements.machines and requirements.inputs
// to select blueprints from catalog
```
