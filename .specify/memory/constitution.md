<!--
SYNC IMPACT REPORT
==================
Version: 0.0.0 → 1.0.0 (Initial Constitution)

MODIFIED PRINCIPLES: N/A (initial creation)

ADDED SECTIONS:
- Core Principles (5 principles defined)
- Data & Validation Standards
- Development Workflow
- Governance

REMOVED SECTIONS: N/A

TEMPLATES REQUIRING UPDATES:
✅ plan-template.md - Constitution Check section will reference these 5 principles
✅ spec-template.md - User stories must align with tool-oriented, testable design
✅ tasks-template.md - Task structure supports tool development and testing workflow

FOLLOW-UP TODOs: None

RATIONALE FOR VERSION 1.0.0:
This is the initial ratification of the Factorio AI project constitution.
Major version 1 signals the foundational governance model is now in place.
-->

# Factorio AI Constitution

## Core Principles

### I. Tool-First Architecture

Every feature is implemented as an independent, composable tool.

**Rules:**
- Each tool MUST be a standalone executable with a single, clear purpose
- Tools MUST expose functionality via CLI (command-line interface)
- Tools MUST accept input via stdin, arguments, or file paths
- Tools MUST output results to stdout, errors to stderr
- Tools MUST support both JSON and human-readable output formats where applicable
- No tool may depend on another tool's internal implementation details

**Rationale:** AI agents need discrete, composable units they can orchestrate. Tool independence enables parallel development, testing, and reuse. Clear CLI contracts ensure AI can invoke tools reliably without understanding their internals.

### II. External Data as Source of Truth (NON-NEGOTIABLE)

All game data and reference values MUST come from external, versioned data files.

**Rules:**
- Recipe data, entity speeds, and crafting times MUST be maintained in `data/recipes.json`
- No hardcoded game values in source code
- Data schema changes require version tracking
- Tool outputs MUST be validated against expected values from data files
- Any deviation between tool output and data source is a bug, not a feature

**Rationale:** Factorio game data changes with updates. External data files provide a single source of truth that can be updated independently of code. This prevents drift, enables version control, and ensures AI agents work with accurate, current game information.

### III. Test-Driven Validation (NON-NEGOTIABLE)

Tests define correctness; implementation follows.

**Rules:**
- Test data with expected outputs MUST exist before implementation (e.g., `blueprints/*/expected.json`)
- Tests written → User approved → Tests fail → Then implement
- Red-Green-Refactor cycle strictly enforced
- Every tool MUST have integration tests comparing actual vs. expected output
- Test failures block deployment

**Rationale:** AI agents compose designs to hit specific targets (e.g., science per second). Without rigorous validation, composition errors compound. Test-first ensures tools are correct before AI uses them, and expected outputs serve as executable specifications.

### IV. Observable & Debuggable

Every tool operation MUST be inspectable and verifiable by humans and AI agents.

**Rules:**
- ASCII visualization required for spatial tools (blueprint-ascii.ts)
- Structured logging for rate calculations and composition operations
- Every transformation (rotate, flip, compose) MUST be reversible or traceable
- Metadata commands (bp-meta) MUST expose blueprint structure for AI queries
- Human-readable output formats available alongside machine formats

**Rationale:** AI agents need to query game state, verify composition correctness, and route resources. Observability enables AI to reason about designs (e.g., "Where can I place a new mining outpost?"). ASCII rendering lets both humans and AI visually validate spatial logic.

### V. Simplicity & Single Responsibility

Start minimal; complexity requires justification.

**Rules:**
- Each tool does ONE thing well (decode, encode, compose, calculate, visualize)
- No feature bloat—new capabilities spawn new tools, not tool extensions
- Dependencies minimized (TypeScript, ts-node, pako for compression only)
- YAGNI (You Aren't Gonna Need It) principle applies to all additions
- Composition over monoliths: combine tools via shell pipes or AI orchestration

**Rationale:** Simple tools are easier for AI to understand, invoke, and combine. Single responsibility reduces cognitive load, prevents coupling, and allows tools to evolve independently. Complexity compounds errors in AI-driven workflows.

## Data & Validation Standards

### Data Schema Requirements

- `data/recipes.json` MUST include:
  - Entity types (furnace, assembling-machine, etc.)
  - Recipe inputs, outputs, and crafting times
  - Production speeds per entity
  - Belt throughput rates
- Schema version field required for compatibility checks
- JSON format with comments allowed for documentation

### Validation Gates

- **Decode/Encode Round-trip:** Encoded blueprint MUST decode to identical JSON
- **Rate Calculator:** Output MUST match expected throughput within 1% tolerance
- **Composition Alignment:** Composed blueprints MUST maintain entity spacing and connections
- **ASCII Rendering:** Visual grid MUST correctly represent entity positions and orientations

### Expected Output Files

Test blueprints under `blueprints/*` MUST include:
- `.bp` file (encoded blueprint string)
- `.json` file (decoded blueprint)
- `.expected.json` or `golden_*.ascii` file (expected output for validation)

## Development Workflow

### Tool Development Cycle

1. **Define**: Document tool purpose, inputs, outputs, and expected behavior
2. **Test Data**: Create blueprint test case with expected output in `blueprints/[test-name]/`
3. **Write Test**: Implement test comparing tool output to expected output
4. **Verify Failure**: Confirm test fails before implementation
5. **Implement**: Build tool following CLI contract
6. **Validate**: Run test, achieve green, refactor if needed
7. **Document**: Update README with usage examples and npm script entry

### Tool Integration for AI

Each tool MUST document:
- **Purpose:** Single sentence describing what the tool does
- **Usage:** CLI invocation pattern with all flags/arguments
- **Input Format:** Expected data structure (JSON schema, file format)
- **Output Format:** Returned data structure (stdout, file location)
- **Error Handling:** stderr patterns for common failures
- **AI Query Support:** What questions this tool helps AI answer (e.g., "rate-calculator answers: How many furnaces do I need for X items/second?")

### Resource Routing (AI Decision Support)

AI agents compose modules by routing resources through:
- **Source:** Mining outposts producing raw materials
- **Manufacturing:** Smelting (ore → plates) and crafting (plates → intermediates)
- **Drain:** Science pack production consuming intermediates

Tools MUST support queries:
- "What entities exist at position (x, y)?" (bp-meta)
- "What is the throughput of this blueprint?" (rate-calculator)
- "Can I tile this unit N times to hit target rate?" (compose-blueprint + rate-calculator)
- "How do I route belt from module A to module B?" (Future: pathfinding tool)

## Governance

### Amendment Process

- Constitution changes require:
  1. Documented rationale for change
  2. Impact analysis on existing tools and templates
  3. Migration plan if breaking changes introduced
  4. Version bump following semantic versioning
- All PRs MUST verify compliance with current constitution
- Complexity additions MUST be justified in plan.md "Complexity Tracking" section

### Versioning Policy

- **MAJOR:** Principle removal/redefinition breaking existing tool contracts
- **MINOR:** New principle added or section materially expanded
- **PATCH:** Clarifications, wording improvements, non-semantic updates

### Compliance Verification

- Every feature spec MUST include "Constitution Check" (see plan-template.md)
- Code reviews verify tools follow CLI contract, data source usage, and test coverage
- Tool additions require corresponding test blueprints with expected outputs

### Runtime Guidance

For day-to-day development guidance aligned with this constitution, see:
- `.specify/templates/plan-template.md` for feature planning
- `.specify/templates/spec-template.md` for requirement capture
- `.specify/templates/tasks-template.md` for implementation task structure
- `README.md` for current tool usage and composition workflow

**Version**: 1.0.0 | **Ratified**: 2025-12-10 | **Last Amended**: 2025-12-10
