# Rate Calculator

A standalone TypeScript tool for querying Factorio production requirements using Kirk McDonald's calculator. This can be extracted and used independently from the main project.

## Features

- Query Kirk McDonald's Factorio calculator programmatically
- Automatic caching of results (7-day TTL by default)
- Full TypeScript support with strict type checking
- Selenium-based calculator interaction for reliable data extraction
- JSON and human-readable output formats

## Installation

### Prerequisites

- Node.js 16+ 
- npm or yarn
- Chrome/Chromium browser (for Selenium WebDriver)

### Setup

1. Extract this folder to your desired location
2. Install dependencies:

```bash
npm install
```

## Usage

### Command Line

```bash
npm run calc-req -- --item <item-id> --rate <number> [options]
```

### Required Arguments

- `--item <item-id>`: Factorio item ID (e.g., `automation-science-pack`, `engine-unit`)
- `--rate <number>`: Desired production rate (positive number)

### Optional Arguments

- `--rate-unit <unit>`: Time unit for rate: `s` (second), `m` (minute, default), `h` (hour)
- `--assembler <id>`: Assembler type (default: `assembling-machine-2`)
- `--furnace <id>`: Furnace type (default: `stone-furnace`)
- `--miner <id>`: Mining drill type (default: `electric-mining-drill`)
- `--belt <id>`: Transport belt type (default: `fast-transport-belt`)
- `--version <version>`: Factorio version (default: `2.0`)
- `--output <path>`: Save JSON output to file
- `--json`: Output JSON format (default: human-readable)
- `--no-cache`: Skip cache and query calculator fresh
- `--clear-cache`: Clear cached entry before querying
- `--quiet`: Suppress informational output to stderr

### Examples

Basic usage (production rate per minute):
```bash
npm run calc-req -- --item engine-unit --rate 90
```

Production rate per second with custom machines:
```bash
npm run calc-req -- \
  --item automation-science-pack \
  --rate 1 \
  --rate-unit s \
  --assembler assembling-machine-3 \
  --furnace electric-furnace
```

Save JSON output to file:
```bash
npm run calc-req -- \
  --item iron-plate \
  --rate 100 \
  --output results.json \
  --json
```

Clear cache and re-query:
```bash
npm run calc-req -- \
  --item engine-unit \
  --rate 90 \
  --clear-cache \
  --quiet
```

## Output Format

### Human-Readable (Default)

```
Production Requirements for automation-science-pack at 60/m
======================================================================
Calculator URL: https://kirkmcdonald.github.io/calc.html#data=2-0-55&...

Machines Required:
  - 0.5x assembling-machine-2 (automation-science-pack)

Input Resources:
  - 45/m copper-ore
  - 45/m iron-ore

Intermediate Products:
  - 22.5/m copper-plate
  - 22.5/m iron-plate

Cached: Yes (2025-12-10T15:30:45.123Z)
Cache Key: a1b2c3d4e5f6g7h8
```

### JSON Format

```bash
npm run calc-req -- --item engine-unit --rate 90 --json
```

Output:
```json
{
  "targetItem": "engine-unit",
  "targetRate": 90,
  "rateUnit": "m",
  "calculatorUrl": "https://kirkmcdonald.github.io/calc.html#...",
  "factorioVersion": "2.0",
  "machines": [
    {
      "type": "assembling-machine-2",
      "recipe": "engine-unit",
      "count": 3.75
    }
  ],
  "inputs": [
    {
      "resource": "iron-ore",
      "rate": 135
    },
    {
      "resource": "copper-ore",
      "rate": 90
    }
  ],
  "dependencies": [],
  "timestamp": "2025-12-10T15:30:45.123Z",
  "cacheKey": "a1b2c3d4e5f6g7h8"
}
```

## Cache

Results are automatically cached in `.factorio-cache/requirements/` with a 7-day TTL. Cache entries are keyed by a hash of the calculator URL, so identical queries use cached results.

Cache management:
- **Auto cache**: Enabled by default, check `.factorio-cache/requirements/*.json`
- **Skip cache**: Use `--no-cache` flag
- **Clear cache**: Use `--clear-cache` flag before querying
- **Change TTL**: Modify `CacheService` constructor in `src/services/cache-service.ts`

## Project Structure

```
rate-calculator/
├── src/
│   ├── lib/
│   │   └── file-utils.ts          # File I/O utilities
│   ├── models/
│   │   ├── calculator-config.ts   # Configuration types & validation
│   │   └── production-requirement.ts # Output types & creation
│   └── services/
│       ├── cache-service.ts       # Cache management
│       └── selenium-calculator.ts # Calculator query via Selenium
├── scripts/
│   └── calculate-requirements.ts  # Main CLI entry point
├── data/                          # (empty, for future data files)
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Running Tests

Create test files in the root or in a `tests/` directory and run:

```bash
npm test
```

### Building TypeScript

This project uses `tsx` for runtime compilation, so no separate build step is needed. For production, consider adding a build script that compiles to `.js`:

```json
{
  "scripts": {
    "build": "tsc --outDir dist"
  }
}
```

### Extending

The tool is modular and can be extended by:

1. **Adding new models**: Add interfaces in `src/models/`
2. **Adding services**: Create new services in `src/services/`
3. **Modifying extraction logic**: Update selectors in `src/services/selenium-calculator.ts`
4. **Custom caching**: Extend or replace `CacheService`

## Architecture

### Selenium Calculator Service

Queries Kirk McDonald's calculator by:
1. Launching headless Chrome via Selenium WebDriver
2. Navigating to the calculator URL
3. Waiting for the results table to populate
4. Extracting machine counts, inputs, and dependencies via DOM selectors

**Note**: Selectors may need adjustment if Kirk McDonald's calculator HTML changes.

### Cache Service

Implements time-based caching with:
- Per-URL hashing for efficient lookups
- TTL-based expiration (default 7 days)
- Atomic operations (get/set/delete)
- Cache statistics and cleanup

## Troubleshooting

### Selenium Connection Issues

If queries fail with connection errors:

1. Ensure Chrome/Chromium is installed
2. Check Chrome binary path: `which google-chrome` or `which chromium`
3. Test connection:
```bash
node -e "const {SeleniumCalculatorService} = require('./src/services/selenium-calculator'); new SeleniumCalculatorService().testConnection().then(console.log)"
```

### No Machines/Inputs Found

Selenium selectors may be outdated. Check Kirk McDonald's calculator HTML:

1. Open `https://kirkmcdonald.github.io/calc.html` in browser
2. Inspect the results table with DevTools
3. Update selectors in `src/services/selenium-calculator.ts`:
   - `#totals tbody.display-group` (results container)
   - `tr.display-row` (machine rows)
   - `td.item-icon img.icon` (item name)
   - `td.building-icon img.icon` (machine type)
   - `tt.building-count` (machine count)

### Cache Issues

Clear cache and try again:

```bash
npm run calc-req -- --item engine-unit --rate 90 --clear-cache --no-cache
```

## Dependencies

- **selenium-webdriver** (^4.39.0): Browser automation
- **typescript** (^5.9.3): Type checking and compilation
- **tsx** (^4.21.0): TypeScript execution for Node.js
- **@types/node** (^18.19.130): Node.js type definitions

## License

ISC

## Contributing

This is a standalone extraction of the rate calculator from the [factorio-ai](https://github.com/Ober3550/factorio-ai) project. To contribute, open issues or PRs at the main repository.

## See Also

- [Kirk McDonald's Factorio Calculator](https://kirkmcdonald.github.io/calc.html)
- [Factorio Wiki](https://wiki.factorio.com/)
- [factorio-ai Repository](https://github.com/Ober3550/factorio-ai)
