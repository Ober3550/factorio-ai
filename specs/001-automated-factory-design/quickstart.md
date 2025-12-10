# Quickstart Guide: Automated Factory Design System

**Date**: 2025-12-10  
**For**: Developers and AI agents implementing/using the factory design toolset

---

## Overview

This guide demonstrates the complete workflow from production requirements to optimized factory design using the four CLI tools:

1. **calculate-requirements**: Query Kirk McDonald calculator for machine counts
2. **catalog-blueprint**: Manage blueprint library with metadata
3. **compose-factory**: Auto-generate factory block from requirements
4. **optimize-placement**: Position factory near resource sources

---

## Prerequisites

### Installation

```bash
# Install dependencies
npm install

# Install Selenium WebDriver (Chrome example)
# macOS:
brew install chromedriver

# Linux:
sudo apt-get install chromium-chromedriver

# Verify installation
chromedriver --version
```

### Prepare Blueprint Catalog

Before composing factories, populate the catalog with blueprints:

```bash
# Example: Add a smelting blueprint
node --loader ts-node/esm scripts/catalog-blueprint.ts add \
  --blueprint blueprints/smelting/smelting_4col_2row.bp \
  --name "Iron Smelting Array (4x2)" \
  --dimensions 24x12 \
  --primary-output iron-plate:180 \
  --input iron-ore:180:0,6 \
  --output iron-plate:180:23,6 \
  --tag smelting --tag iron --tag mid-game

# Add more blueprints for complete production chains
# (gear production, circuit production, science assembly, etc.)
```

---

## Workflow 1: Simple Factory Design

**Goal**: Design a factory to produce 60 automation science packs per minute

### Step 1: Calculate Requirements

```bash
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item automation-science-pack \
  --rate 60 \
  --assembler assembling-machine-2 \
  --furnace electric-furnace \
  --output requirements/automation-60pm.json \
  --json
```

**Output** (`requirements/automation-60pm.json`):
```json
{
  "targetItem": "automation-science-pack",
  "targetRate": 60,
  "machines": [
    {"type": "assembling-machine-2", "recipe": "automation-science-pack", "count": 3.0},
    {"type": "assembling-machine-2", "recipe": "iron-gear-wheel", "count": 1.5},
    {"type": "electric-furnace", "recipe": "iron-plate", "count": 0.75},
    {"type": "electric-furnace", "recipe": "copper-plate", "count": 0.5}
  ],
  "inputs": [
    {"resource": "iron-ore", "rate": 90},
    {"resource": "copper-ore", "rate": 45}
  ],
  "calculatorUrl": "https://kirkmcdonald.github.io/calc.html#...",
  ...
}
```

### Step 2: Compose Factory Block

```bash
node --loader ts-node/esm scripts/compose-factory.ts \
  --requirements requirements/automation-60pm.json \
  --name "Automation Science 60/min" \
  --output factory-designs/automation-60pm.json \
  --visualize
```

**Output**:
```
Factory Block: Automation Science 60/min
=========================================
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

Saved to: factory-designs/automation-60pm.json
```

### Step 3: Optimize Placement (Optional)

```bash
# Create resource map
cat > resources/main-base.json << EOF
[
  {"resource": "iron-ore", "position": {"x": 100, "y": 200}, "name": "Main Iron"},
  {"resource": "copper-ore", "position": {"x": 150, "y": 180}, "name": "Main Copper"}
]
EOF

# Optimize placement
node --loader ts-node/esm scripts/optimize-placement.ts \
  --factory factory-designs/automation-60pm.json \
  --resources resources/main-base.json \
  --algorithm centroid \
  --output factory-designs/automation-60pm-placed.json
```

**Output**:
```
Optimal Factory Position: (115, 195)

Routing Distances:
  - iron-ore -> factory: 15 tiles
  - copper-ore -> factory: 44 tiles
Total: 59 tiles

Belt Routing Metadata saved for external routing tool
```

---

## Workflow 2: Pipeline Mode (AI-Friendly)

**Goal**: End-to-end factory design in a single pipeline

```bash
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item chemical-science-pack \
  --rate 45 \
  --json \
| node --loader ts-node/esm scripts/compose-factory.ts \
  --requirements /dev/stdin \
  --json \
| node --loader ts-node/esm scripts/optimize-placement.ts \
  --factory /dev/stdin \
  --resources resources/main-base.json \
  --json \
  > factory-designs/chemical-45pm-final.json
```

**Result**: Complete factory design in `factory-designs/chemical-45pm-final.json`

---

## Workflow 3: Catalog Management

### Search Catalog

```bash
# Find all iron plate production blueprints
node --loader ts-node/esm scripts/catalog-blueprint.ts search \
  --item iron-plate \
  --min-throughput 100

# Find compact blueprints (< 20x20)
node --loader ts-node/esm scripts/catalog-blueprint.ts search \
  --max-dimensions 20x20 \
  --sort-by efficiency
```

### Get Blueprint Details

```bash
node --loader ts-node/esm scripts/catalog-blueprint.ts get \
  --id smelting-4col-2row \
  --json > blueprint-details.json
```

### Update Blueprint

```bash
node --loader ts-node/esm scripts/catalog-blueprint.ts update \
  --id smelting-4col-2row \
  --tag "verified" \
  --tag "tested"
```

---

## Workflow 4: Iterative Design

**Scenario**: Design doesn't fit in available space, need to optimize

```bash
# Initial design is too large
node --loader ts-node/esm scripts/compose-factory.ts \
  --requirements requirements/science.json \
  --max-width 50 \
  --max-height 50 \
  --output factory-designs/science-compact.json

# If fails: "Cannot fit modules within 50x50"
# Solution: Use smaller blueprints or increase dimensions
```

---

## Workflow 5: Technology Progression

### Early Game (Basic Technology)

```bash
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item automation-science-pack \
  --rate 30 \
  --assembler assembling-machine-1 \
  --furnace stone-furnace \
  --miner burner-mining-drill \
  --belt transport-belt \
  --output requirements/early-game.json
```

### Late Game (Advanced Technology)

```bash
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item space-science-pack \
  --rate 1000 \
  --assembler assembling-machine-3 \
  --furnace electric-furnace \
  --miner electric-mining-drill \
  --belt express-transport-belt \
  --version 1.1 \
  --output requirements/late-game.json
```

---

## Workflow 6: Multi-Product Factory

**Goal**: Design factory producing multiple science types

```bash
# Calculate requirements for each science type
for science in automation-science-pack logistic-science-pack; do
  node --loader ts-node/esm scripts/calculate-requirements.ts \
    --item $science \
    --rate 60 \
    --json \
    --output requirements/${science}-60pm.json
done

# Compose factories separately
for req in requirements/*-60pm.json; do
  base=$(basename $req .json)
  node --loader ts-node/esm scripts/compose-factory.ts \
    --requirements $req \
    --json \
    --output factory-designs/${base}-factory.json
done

# AI Agent Note: For true multi-product shared-resource factories,
# merge requirements before composition (requires custom logic)
```

---

## Workflow 7: Cache Management

### View Cached Calculator Results

```bash
ls -lh .factorio-cache/requirements/
```

### Clear Specific Cache Entry

```bash
# Force refresh for specific item
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item automation-science-pack \
  --rate 60 \
  --clear-cache
```

### Clear All Cache

```bash
rm -rf .factorio-cache/requirements/*
```

---

## AI Agent Integration Examples

### Example 1: Python Script Using Tools

```python
import subprocess
import json

def calculate_requirements(item, rate):
    result = subprocess.run([
        'node', '--loader', 'ts-node/esm',
        'scripts/calculate-requirements.ts',
        '--item', item,
        '--rate', str(rate),
        '--json'
    ], capture_output=True, text=True)
    return json.loads(result.stdout)

def compose_factory(requirements):
    result = subprocess.run([
        'node', '--loader', 'ts-node/esm',
        'scripts/compose-factory.ts',
        '--requirements', '/dev/stdin',
        '--json'
    ], input=json.dumps(requirements), capture_output=True, text=True)
    return json.loads(result.stdout)

# Usage
req = calculate_requirements('automation-science-pack', 60)
factory = compose_factory(req)
print(f"Factory size: {factory['dimensions']['width']}x{factory['dimensions']['height']}")
```

### Example 2: AI Agent Reasoning

```
AI Goal: Design factory for 100 green circuits/min

1. Query production requirements:
   -> Use calculate-requirements tool
   -> Extract machine counts and input resources

2. Check blueprint catalog:
   -> Use catalog-blueprint search for "electronic-circuit"
   -> Find blueprints producing green circuits

3. Compose factory:
   -> Use compose-factory with requirements
   -> Verify alignment score > 0.9 (SC-007 requirement)

4. If catalog missing blueprints:
   -> Report to user: "Missing blueprint for X"
   -> User adds blueprint with catalog-blueprint add
   -> Retry step 2

5. Optimize placement:
   -> Use optimize-placement with user's resource map
   -> Report optimal position and routing distances
```

---

## Testing Your Setup

### Run Example End-to-End

```bash
# Test complete workflow
./test-factory-design.sh automation-science-pack 60

# Expected: Complete factory design in < 30 seconds
```

### Validate Tools Individually

```bash
# Test calculator integration
node --loader ts-node/esm scripts/calculate-requirements.ts \
  --item iron-plate --rate 100

# Test catalog operations
node --loader ts-node/esm scripts/catalog-blueprint.ts list

# Test composition (requires catalog)
node --loader ts-node/esm scripts/compose-factory.ts \
  --requirements blueprints/compose-test/simple-test.requirements.json
```

---

## Common Patterns

### Pattern 1: Batch Processing

```bash
# Design factories for all science types
for science in automation logistic military chemical production utility; do
  echo "Designing $science science factory..."
  node --loader ts-node/esm scripts/calculate-requirements.ts \
    --item "${science}-science-pack" \
    --rate 60 \
    --json \
  | node --loader ts-node/esm scripts/compose-factory.ts \
    --requirements /dev/stdin \
    --name "$science Science 60/min" \
    --json \
    --output "factory-designs/${science}-60pm.json"
done
```

### Pattern 2: Technology Comparison

```bash
# Compare early vs late game designs
for tech in early mid late; do
  case $tech in
    early) asm="assembling-machine-1"; furnace="stone-furnace" ;;
    mid)   asm="assembling-machine-2"; furnace="steel-furnace" ;;
    late)  asm="assembling-machine-3"; furnace="electric-furnace" ;;
  esac
  
  node --loader ts-node/esm scripts/calculate-requirements.ts \
    --item automation-science-pack \
    --rate 60 \
    --assembler $asm \
    --furnace $furnace \
    --output "requirements/automation-${tech}-game.json"
done
```

### Pattern 3: Incremental Scaling

```bash
# Design factories for different production rates
for rate in 30 60 90 120; do
  node --loader ts-node/esm scripts/calculate-requirements.ts \
    --item automation-science-pack \
    --rate $rate \
    --json \
  | node --loader ts-node/esm scripts/compose-factory.ts \
    --requirements /dev/stdin \
    --name "Automation Science ${rate}/min" \
    --json \
    --output "factory-designs/automation-${rate}pm.json"
  
  # Report dimensions
  width=$(jq '.dimensions.width' factory-designs/automation-${rate}pm.json)
  height=$(jq '.dimensions.height' factory-designs/automation-${rate}pm.json)
  echo "Rate: ${rate}/min -> Size: ${width}x${height}"
done
```

---

## Troubleshooting

### Issue: "Calculator timeout"

**Cause**: Selenium cannot reach Kirk McDonald calculator

**Solutions**:
- Check internet connection
- Verify chromedriver installed: `chromedriver --version`
- Try manual URL in browser to verify calculator is up

### Issue: "No blueprint found producing X"

**Cause**: Blueprint catalog missing required blueprint

**Solutions**:
- List catalog: `node --loader ts-node/esm scripts/catalog-blueprint.ts list`
- Add missing blueprint with `catalog-blueprint add`
- Check blueprint metadata has correct `primaryOutput.item`

### Issue: "Cannot fit modules within dimensions"

**Cause**: Composed factory exceeds --max-width or --max-height

**Solutions**:
- Remove dimension constraints
- Use smaller blueprints (lower throughput per module)
- Split into multiple smaller factories

### Issue: "Circular dependency detected"

**Cause**: Production chain has circular requirements (rare in vanilla Factorio)

**Solutions**:
- Check data/recipes.json for accuracy
- Manually break cycle by providing intermediate product externally

---

## Next Steps

1. **Implement Tools**: Follow contracts in `contracts/` directory
2. **Populate Catalog**: Add blueprints for common production modules
3. **Create Tests**: Use test fixtures in `blueprints/*/expected.json`
4. **Integrate with AI**: Use tools in AI agent workflows for automated design

---

## Additional Resources

- **Spec**: [spec.md](./spec.md) - Full feature specification
- **Data Models**: [data-model.md](./data-model.md) - Entity schemas
- **Tool Contracts**: [contracts/](./contracts/) - Detailed CLI documentation
- **Kirk McDonald Calculator**: https://kirkmcdonald.github.io/calc.html
