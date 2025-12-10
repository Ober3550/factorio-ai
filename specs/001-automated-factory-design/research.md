# Research: Automated Factory Design System

**Date**: 2025-12-10  
**Phase**: 0 (Research & Technology Selection)  
**Status**: Complete ✅ (Decisions Implemented in P1)

## Overview

This document resolves all NEEDS CLARIFICATION items from the Technical Context and makes informed technology decisions for the Automated Factory Design System.

---

## Research Item 1: Selenium WebDriver Package for TypeScript

### Question
Which Selenium package should we use: `selenium-webdriver` (official) vs `webdriverio`?

### Research Findings

**selenium-webdriver (Official Selenium)**
- Official W3C WebDriver protocol implementation
- Direct mapping to Selenium Java API
- Simpler API for basic interactions
- Better TypeScript type definitions
- Lower-level control over browser automation
- Active maintenance by Selenium project

**webdriverio**
- Higher-level abstraction over WebDriver protocol
- More extensive ecosystem and plugins
- Built-in test runner and assertion library
- Steeper learning curve
- Optimized for test frameworks (not simple automation)

**Kirk McDonald Calculator Interaction Requirements**:
- Navigate to URL with query parameters
- Wait for page to load and calculate
- Extract machine counts and resource requirements from DOM
- No complex user interactions needed
- Headless mode required for CI/automation

### Decision: `selenium-webdriver` ✅ IMPLEMENTED

**Rationale**:
- Simpler API sufficient for our needs (navigate, wait, extract data)
- Better TypeScript support matches project language
- Lower dependency footprint (aligns with Constitution Principle V: Simplicity)
- Official package with stable long-term maintenance
- No need for webdriverio's test runner features (we use existing test pattern)

**Implementation Notes** (P1):
- Installed `selenium-webdriver@4.39.0` and `@types/selenium-webdriver@4.35.4`
- Created `/src/services/selenium-calculator.ts` with Chrome WebDriver integration
- Headless mode configured for CI/automation compatibility
- Wait strategy: Wait for `#totals` element + 3 second sleep for JavaScript rendering
- Successfully extracts machine counts, input resources, and intermediate dependencies

**Alternatives Considered**:
- Puppeteer/Playwright: Rejected - Chrome-only (Selenium supports multiple browsers for future flexibility)
- Axios + cheerio: Rejected - Kirk McDonald calculator uses client-side JavaScript rendering; need real browser

---

## Research Item 2: Blueprint Catalog Indexing Strategy

### Question
For scaling to 1000+ blueprints: flat JSON files vs embedded database?

### Research Findings

**Flat JSON Files (Current Pattern)**
- Existing project uses `blueprints/*/file.json` structure
- Simple to version control and inspect
- No additional dependencies
- Search requires loading all files into memory
- O(n) search complexity

**Embedded Databases**
- SQLite: Requires `better-sqlite3` or `sql.js` dependency
- LowDB: JSON file database for Node.js
- NeDB: Embedded persistent datastore (deprecated, no longer maintained)

**Performance Analysis**:
- 1000 JSON files @ ~10KB each = ~10MB total
- Modern systems load 10MB < 100ms
- Node.js `fs.readFileSync` benchmarks: ~1000 files/sec
- Success Criteria SC-006: < 1 second search in 1000 blueprints

**Search Patterns Required**:
- Filter by produced item (FR-007)
- Filter by required input (FR-007)
- Filter by minimum throughput (FR-007)
- Filter by maximum dimensions (FR-007)
- Sort by efficiency (throughput/area)

### Decision: Flat JSON Files with In-Memory Index ⏳ PENDING (P2)

**Rationale**:
- Meets SC-006 performance requirement (< 1 second for 1000 blueprints)
- Follows existing project pattern (External Data as Source of Truth principle)
- No new dependencies (Simplicity principle)
- Easy to version control and inspect (Observable & Debuggable principle)
- On-demand indexing: load all blueprints into memory on first catalog query, cache index
- 10MB memory footprint acceptable for CLI tool

**Implementation Strategy**:
- Lazy-load catalog on first use
- Build in-memory search index (Map<item, Blueprint[]>) for O(1) item lookup
- Support JSON query filtering in `catalog-blueprint.ts --search '{"item": "iron-plate", "min-throughput": 100}'`
- Cache index per process lifetime (CLI tools are short-lived, no stale data issues)

**Alternatives Considered**:
- SQLite: Rejected - adds dependency, overkill for 1000 records, violates Simplicity principle
- LowDB: Rejected - still uses JSON files, adds abstraction without performance benefit
- Keep all in single file: Rejected - breaks existing pattern, merge conflicts in version control

**Implementation Status**: To be implemented in P2 (Blueprint Catalog Management)

---

## Research Item 3: Kirk McDonald Calculator Query String Parameters

### Question
What query string parameters are available for technology levels and configuration?

### Research Findings

**Kirk McDonald Calculator URL Structure**:
Base URL: `https://kirkmcdonald.github.io/calc.html#`

**Available Query Parameters** (from calculator documentation and reverse engineering):
- `items`: Production targets (e.g., `items=automation-science-pack:r:60`)
- `rate`: Time unit (e.g., `rate=m` for per minute, `s` for per second)
- `miners`: Miner type (e.g., `miners=electric-mining-drill`)
- `furnace`: Furnace type (e.g., `furnace=stone-furnace`, `steel-furnace`, `electric-furnace`)
- `assembler`: Assembler tier (e.g., `assembler=assembling-machine-1`, `assembling-machine-2`, `assembling-machine-3`)
- `modules`: Productivity/speed modules (complex format, varies by recipe)
- `belt`: Belt type (e.g., `belt=transport-belt`, `fast-transport-belt`, `express-transport-belt`)
- `fuel`: Fuel type for certain recipes
- `version`: Factorio version (e.g., `version=1.1`)

**Example URL**:
```
https://kirkmcdonald.github.io/calc.html#items=automation-science-pack:r:60&rate=m&assembler=assembling-machine-2&furnace=electric-furnace&miners=electric-mining-drill&belt=fast-transport-belt&version=1.1
```

**Technology Level Mapping**:
- Early game: assembling-machine-1, stone-furnace, burner-mining-drill, transport-belt
- Mid game: assembling-machine-2, steel-furnace, electric-mining-drill, fast-transport-belt
- Late game: assembling-machine-3, electric-furnace, electric-mining-drill, express-transport-belt

### Decision: Store Full Calculator URL in Metadata ✅ IMPLEMENTED

**Rationale**:
- FR-002: "System MUST accept user input specifying target item(s) and desired production rate"
- User requirement: "save the built url as part of the metadata for the factory requirements"
- Reproducibility: Anyone can re-run calculation by visiting saved URL
- Observable & Debuggable: URL reveals all assumptions (technology level, modules, belts)
- Versioning: URL includes Factorio version, handles game updates

**Implementation Strategy**:
```typescript
// Tool: calculate-requirements.ts
interface CalculatorConfig {
  items: { name: string; rate: number }[]
  rateUnit: 's' | 'm' | 'h' // second, minute, hour
  technology: {
    assembler: string // e.g., "assembling-machine-2"
    furnace: string
    miner: string
    belt: string
  }
  version: string // e.g., "1.1"
}

interface ProductionRequirement {
  targetItem: string
  targetRate: number
  calculatorUrl: string // Full URL for reproducibility
  machines: { type: string; count: number }[]
  inputs: { resource: string; rate: number }[]
  timestamp: string
}
```

**Alternatives Considered**:
- Parse calculator output without saving URL: Rejected - loses reproducibility and technology context
- Store only parameters separately: Rejected - URL is canonical representation, easier to verify manually

**Implementation Notes** (P1):
- Corrected URL format to use: `data=2-0-55&rate=m&buildings=assembling-machine-2,stone-furnace&items=automation-science-pack:r:90`
- User provided example URL clarified that `buildings` parameter takes comma-separated list instead of individual parameters
- `buildCalculatorUrl()` function in `calculator-config.ts` generates proper URLs
- Default technology: assembling-machine-2, stone-furnace, electric-mining-drill, transport-belt
- Default version: 2.0 (Factorio 2.0.55)
- Full URLs saved in ProductionRequirement metadata for reproducibility

---

## Research Item 4: Selenium Best Practices for Kirk McDonald Calculator

### Question
How should we interact with the calculator DOM to extract machine counts reliably?

### Research Findings

**Kirk McDonald Calculator DOM Structure** (subject to change):
- Results displayed in HTML table after client-side calculation
- Each row represents a recipe/machine type
- Columns: Item name, Machine count, Input rates, Output rates
- JavaScript rendering completes ~500ms after page load
- No AJAX requests (all calculation done client-side)

**Selenium Wait Strategies**:
1. Implicit wait: Global timeout for element searches
2. Explicit wait: Wait for specific condition (e.g., element visible)
3. Polling: Repeatedly check until condition met

**Stability Concerns**:
- Calculator layout may change in updates (external tool, not under our control)
- CSS selectors may break
- Need graceful degradation if parsing fails

### Decision: Explicit Waits + CSS Selectors + Fallback Error Handling ✅ IMPLEMENTED

**Implementation Strategy**:
```typescript
// Selenium interaction pattern
async function extractMachineRequirements(driver: WebDriver, url: string): Promise<ProductionRequirement> {
  await driver.get(url)
  
  // Explicit wait for results table to appear
  await driver.wait(until.elementLocated(By.css('.results-table')), 10000)
  
  // Wait for calculation to complete (check for specific content)
  await driver.wait(until.elementLocated(By.css('.machine-count')), 10000)
  
  // Extract data from DOM
  const rows = await driver.findElements(By.css('.results-table tr'))
  const machines: Machine[] = []
  
  for (const row of rows) {
    const type = await row.findElement(By.css('.machine-type')).getText()
    const count = await row.findElement(By.css('.machine-count')).getText()
    machines.push({ type, count: parseFloat(count) })
  }
  
  return { machines, calculatorUrl: url, ... }
}
```

**Error Handling**:
- Timeout after 10 seconds if calculator doesn't load
- Catch CSS selector errors and provide actionable error message
- Include calculator URL in error output so user can manually verify
- Log page source to file on failure for debugging

**Alternatives Considered**:
- XPath selectors: Rejected - more fragile than CSS selectors
- Implicit waits: Rejected - less control, harder to debug
- Screenshot + OCR: Rejected - complex, unreliable, violates Simplicity principle

**Implementation Notes** (P1):
- **Actual DOM Selectors** (verified working with Kirk McDonald calculator):
  - Main table: `#totals` (wait for this element)
  - Display groups: `tbody.display-group` (one per production chain level)
  - Display rows: `tr.display-row` (each row = one machine/recipe)
  - Machine info: `td.building-icon img.icon` (alt attribute = machine type), `tt.building-count` (count text)
  - Item info: `td.item-icon img.icon` (alt attribute = item name), `tt.item-rate` (rate text)
- **Wait Strategy**: Wait for `#totals` element + 3 second sleep for JavaScript rendering
- **Data Extraction Methods**:
  - `extractMachines()`: Queries all display rows, extracts machine type/recipe/count
  - `extractInputs()`: Finds rows with "mining drill" (raw resources), extracts resource name and rate
  - `extractDependencies()`: Captures intermediate products from display groups (skips first group)
- **Headless Mode**: Chrome runs headless for CI/automation
- **Performance**: ~3-5 seconds per query (cold), < 100ms (warm with cache)

---

## Research Item 5: Caching Strategy for Calculator Results

### Question
How should we cache calculator results to avoid repeated Selenium launches?

### Research Findings

**Cache Key Requirements**:
- Must include: target item, rate, technology levels, Factorio version
- Calculator URL is perfect cache key (contains all parameters)

**Cache Storage Options**:
1. In-memory (process lifetime)
2. File system (persistent across runs)
3. No cache (always query calculator)

**Performance Impact**:
- Selenium browser launch + navigation: ~2-3 seconds
- Cache hit: < 10ms (file read or memory lookup)
- CLI tools typically run once per user command (short-lived processes)

**Use Case Analysis**:
- User iterates on factory design, may query same item multiple times
- Technology level changes infrequent (early → mid → late game transitions)
- Factorio version changes every few months

### Decision: File System Cache with TTL ✅ IMPLEMENTED

**Rationale**:
- Persistent across CLI invocations (user may run multiple commands)
- Invalidation by TTL (cache expires after 7 days, handles game updates)
- Hash calculator URL as cache key (deterministic, no collisions)
- Meets SC-001: < 5 seconds response time (cache hit < 1s, cache miss < 5s)

**Implementation Strategy**:
```typescript
// Cache location: .factorio-cache/requirements/
interface CacheEntry {
  url: string
  result: ProductionRequirement
  cachedAt: string // ISO timestamp
  ttl: number // seconds (default: 604800 = 7 days)
}

function getCacheKey(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').substring(0, 16)
}

async function getRequirements(config: CalculatorConfig): Promise<ProductionRequirement> {
  const url = buildCalculatorUrl(config)
  const cacheKey = getCacheKey(url)
  const cachePath = `.factorio-cache/requirements/${cacheKey}.json`
  
  // Check cache
  if (fs.existsSync(cachePath)) {
    const entry: CacheEntry = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
    const age = Date.now() - new Date(entry.cachedAt).getTime()
    if (age < entry.ttl * 1000) {
      return entry.result // Cache hit
    }
  }
  
  // Cache miss: query calculator
  const result = await queryCalculatorWithSelenium(url)
  fs.writeFileSync(cachePath, JSON.stringify({ url, result, cachedAt: new Date().toISOString(), ttl: 604800 }))
  return result
}
```

**Cache Invalidation**:
- Automatic: TTL expiration (7 days)
- Manual: CLI flag `--no-cache` or `--clear-cache`
- User can inspect cache directory and delete entries

**Alternatives Considered**:
- In-memory only: Rejected - doesn't persist across CLI invocations
- No cache: Rejected - violates SC-001 performance requirement for repeated queries
- Database cache: Rejected - adds dependency, overkill for simple KV storage

**Implementation Notes** (P1):
- Implemented in `/src/services/cache-service.ts` with generic key-value caching
- Cache location: `.factorio-cache/requirements/<cacheKey>.json`
- Cache key: SHA-256 hash of config parameters (first 16 chars)
- Methods: `has()`, `get()`, `set()`, `delete()`, `clear()`, `stats()`
- TTL: 7 days (604800 seconds), configurable
- Performance: < 100ms cache hit, ~3-5 seconds cache miss (Selenium)
- CLI integration: `--no-cache` flag bypasses cache, `--clear-cache` flag clears all cached results
- `.gitignore` updated to exclude `.factorio-cache/` directory

---

## Summary of Decisions

| Item | Decision | Status |
|------|----------|--------|
| Selenium Package | `selenium-webdriver` | ✅ Implemented (P1) |
| Catalog Storage | Flat JSON files + in-memory index | ⏳ Pending (P2) |
| Query Parameters | Store full calculator URL in metadata | ✅ Implemented (P1) |
| DOM Extraction | Explicit waits + CSS selectors | ✅ Implemented (P1) |
| Caching | File system cache with 7-day TTL | ✅ Implemented (P1) |

## Technology Stack Summary

**Core Technologies**:
- TypeScript + Node.js (tsx loader - ts-node/esm has compatibility issues) - existing + updated
- selenium-webdriver - NEW ✅ Installed
- pako - existing (blueprint compression)

**New Dependencies** ✅ INSTALLED:
```json
{
  "dependencies": {
    "selenium-webdriver": "4.39.0"
  },
  "devDependencies": {
    "@types/selenium-webdriver": "4.35.4"
  }
}
```

**No Additional Dependencies Required**:
- Database: Using flat files
- HTTP client: Not needed (Selenium handles browser)
- CLI framework: Node.js + process.argv sufficient (existing pattern)

## Implementation Status

### Phase 0 (Research) - ✅ COMPLETE
All technology decisions made and documented.

### Phase 1 (Design) - ✅ COMPLETE
All design artifacts created (data-model.md, contracts/, quickstart.md).

### Phase 2 (Implementation)

#### P1 - Calculate Requirements - ✅ COMPLETE
- ✅ Data models implemented
- ✅ Selenium integration working
- ✅ Caching functional
- ✅ CLI tool production-ready
- ✅ Tested successfully

**Remaining Priorities**:
- ⏳ P2: Blueprint catalog (CRUD operations, search, validation)
- ⏳ P3: Factory composition (blueprint selection, positioning, connection)
- ⏳ P4: Placement optimization (resource proximity algorithms)
