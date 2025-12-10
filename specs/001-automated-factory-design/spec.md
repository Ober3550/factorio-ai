# Feature Specification: Automated Factory Design System

**Feature Branch**: `001-automated-factory-design`  
**Created**: 2025-12-10  
**Status**: Draft  
**Input**: User description: "I am building a toolset for designing factories for the game factorio. I want it to use the external tool https://kirkmcdonald.github.io/calc.html to set a desired unit per minute for an item (usually 1 or many sciences) and then design a factory block with previous or new modules to satisfy the requirements. I would like to create a catalog of blueprints with known specificiations that can be placed nearest to resource sources with dimension and throughput metadata. Production modules should specify the quantity of input resources aswell as the tile locations of the inputs and outputs so that we can use a different script to route the belts together"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calculate Production Requirements (Priority: P1)

A player wants to produce science packs at a specific rate (e.g., 45 science/minute). They input their target item and desired units per minute into the system, which queries the Kirk McDonald calculator to determine exactly how many assemblers, furnaces, and raw materials are needed to achieve that production rate.

**Why this priority**: This is the foundation of the entire system - without accurate production calculations, no factory can be designed correctly. This delivers immediate value by answering "what do I need to build?"

**Independent Test**: Can be fully tested by providing a target item (e.g., "red science") and rate (e.g., "60/min"), then verifying the system returns accurate counts of required machines and input materials, validated against the Kirk McDonald calculator output.

**Acceptance Scenarios**:

1. **Given** the system is initialized, **When** user specifies "Red Science" at 60 units/minute, **Then** system returns the exact number of assemblers, gear wheels needed, iron plates needed, and copper plates needed per minute
2. **Given** the system is initialized, **When** user specifies multiple science types (Red and Green), **Then** system calculates combined resource requirements accounting for shared inputs
3. **Given** the calculator API is unavailable, **When** user requests calculations, **Then** system provides clear error message indicating calculator service status

---

### User Story 2 - Blueprint Catalog Management (Priority: P2)

A player has built several optimized production modules (e.g., a 4-column smelting array, a circuit board production block). They want to save these as blueprints with metadata describing their dimensions (tile width/height), throughput capacity (items/minute), input/output positions (specific tile coordinates), and resource requirements so the system can automatically select appropriate blueprints for factory designs.

**Why this priority**: This enables reusability and modularity. Once implemented, users can build a library of proven designs that can be composed into larger factories, dramatically reducing design time.

**Independent Test**: Can be fully tested by creating a blueprint (e.g., smelting array), saving it with metadata (24 tiles wide, 12 tiles tall, produces 180 iron plates/min, inputs at [0,6], outputs at [23,6]), then retrieving and verifying all metadata is accurate.

**Acceptance Scenarios**:

1. **Given** a user has a blueprint string, **When** they add it to the catalog with metadata (dimensions: 20x15, throughput: 90 iron plates/min, input positions: [(0,5), (0,10)], output positions: [(19,7)]), **Then** the blueprint is stored and retrievable with all metadata intact
2. **Given** multiple blueprints exist in the catalog, **When** user searches for blueprints producing "iron plates" with throughput >= 100/min, **Then** system returns only matching blueprints sorted by throughput
3. **Given** a blueprint in the catalog, **When** user requests its specifications, **Then** system displays dimensions, throughput, all input/output tile coordinates, and required input resources with quantities
4. **Given** a blueprint is added, **When** it has overlapping input/output positions or invalid dimensions, **Then** system validates and rejects the blueprint with specific error messages

---

### User Story 3 - Automated Factory Block Composition (Priority: P3)

A player wants to produce 120 green circuits per minute. The system analyzes the requirements (copper cables, iron plates), selects appropriate blueprints from the catalog (e.g., a wire production module, a circuit assembly module), positions them optimally based on their dimensions and input/output locations, and generates a complete factory block design that satisfies the production target.

**Why this priority**: This is the ultimate goal - fully automated factory design. It builds on the previous two stories to deliver the complete vision. However, it requires the foundation of accurate calculations (P1) and a catalog of blueprints (P2) to work.

**Independent Test**: Can be fully tested by requesting a factory design for "120 green circuits/min", then verifying the system selects appropriate blueprints, positions them without overlaps, and that the composed design's theoretical throughput matches the 120/min target when all input requirements are met.

**Acceptance Scenarios**:

1. **Given** a catalog with relevant blueprints exists, **When** user requests a factory for "Blue Science" at 45/min, **Then** system generates a complete factory block with all required production modules positioned and connected
2. **Given** a production target is specified, **When** no single blueprint can meet the throughput requirement, **Then** system places multiple instances of appropriate blueprints to meet the target
3. **Given** multiple blueprint options exist, **When** system selects blueprints for composition, **Then** system prioritizes blueprints with higher efficiency (throughput per tile area)
4. **Given** a composed factory block, **When** user exports the design, **Then** output includes the complete blueprint string, total dimensions, all input resource requirements with rates, and tile coordinates for all external inputs/outputs

---

### User Story 4 - Resource Proximity Optimization (Priority: P4)

A player has ore patches at specific map locations and wants to place production modules optimally near these resources. The system considers blueprint dimensions and resource locations to suggest placement positions that minimize belt routing distance from ore patches to factories.

**Why this priority**: This is an optimization feature that improves efficiency but isn't required for basic functionality. It delivers value by reducing material transport time and belt complexity.

**Independent Test**: Can be fully tested by providing resource locations (e.g., iron ore at [100, 200], copper ore at [150, 180]) and a blueprint catalog, then verifying the system suggests blueprint placements that minimize total distance from resources to blueprint inputs.

**Acceptance Scenarios**:

1. **Given** resource locations are provided, **When** system places production modules, **Then** modules requiring those resources are positioned closest to the resource sources
2. **Given** multiple resource types are needed, **When** a blueprint requires both iron and copper, **Then** system positions it to balance distances to both resource locations
3. **Given** limited space near a resource, **When** system cannot fit a blueprint, **Then** system suggests the next best position with distance trade-off information

---

### Edge Cases

- What happens when the Kirk McDonald calculator is unavailable or returns an error?
- How does the system handle blueprints with no specified throughput metadata?
- What happens when requested production rate exceeds the maximum capacity of all available blueprints combined?
- How does the system handle circular dependencies in production chains (e.g., lubricant requires advanced oil processing which requires modules that need lubricant)?
- What happens when blueprint input/output positions conflict during composition (outputs align with outputs instead of inputs)?
- How does the system handle blueprints with multiple outputs of the same resource type at different tile positions?
- What happens when a user requests production for an item not available in the game data or calculator?
- How does the system handle blueprint tile positions that extend beyond reasonable coordinate bounds?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST integrate with Kirk McDonald calculator (https://kirkmcdonald.github.io/calc.html) to retrieve production requirements for any Factorio item at a specified units-per-minute rate
- **FR-002**: System MUST accept user input specifying target item(s) and desired production rate in units per minute
- **FR-003**: System MUST calculate and return the exact quantities of raw materials, intermediate products, and machines required to achieve the specified production rate
- **FR-004**: System MUST maintain a catalog of blueprint specifications including dimensions (width and height in tiles), throughput capacity (items per minute), input resource types and quantities, output resource types and quantities, and tile coordinates for all input and output positions
- **FR-005**: System MUST allow users to add new blueprints to the catalog with complete metadata specification
- **FR-006**: System MUST validate blueprint metadata for consistency (e.g., dimensions are positive integers, input/output coordinates are within blueprint bounds, throughput is positive)
- **FR-007**: System MUST allow users to search the blueprint catalog by produced item, required input, minimum throughput, or maximum dimensions
- **FR-008**: System MUST support automatic selection of appropriate blueprints from the catalog to satisfy production requirements calculated from the Kirk McDonald calculator
- **FR-009**: System MUST compose multiple blueprint modules into a complete factory block design that meets production targets
- **FR-010**: System MUST calculate positioning for composed blueprints to avoid overlaps and align input/output connection points
- **FR-011**: System MUST export complete factory block designs including final blueprint string, total dimensions, aggregate input requirements with rates and tile positions, and aggregate output positions with rates and tile positions
- **FR-012**: System MUST handle blueprints with multiple inputs and/or multiple outputs at different tile positions
- **FR-013**: System MUST support positioning blueprints near specified resource source locations to minimize routing distance
- **FR-014**: System MUST calculate total belt routing requirements between resource sources and factory block inputs
- **FR-015**: System MUST provide belt routing metadata (source coordinates, destination coordinates, required throughput) that can be used by external routing scripts
- **FR-016**: System MUST persist the blueprint catalog across sessions
- **FR-017**: System MUST handle production chains with intermediate products by recursively calculating requirements
- **FR-018**: System MUST support multiple instances of the same blueprint when single instance throughput is insufficient

### Key Entities

- **Blueprint**: Represents a reusable Factorio factory module with attributes: unique identifier, name, encoded blueprint string, dimensions (width, height in tiles), throughput (items per minute for primary output), input specifications (list of resource types, quantities per minute, tile coordinates), output specifications (list of resource types, quantities per minute, tile coordinates), and optional tags/categories
- **Production Requirement**: Represents calculated needs for a target item including: target item name, desired production rate, list of required machines (type and count), list of required input resources (type and rate), and production chain dependencies
- **Factory Block**: Represents a composed factory design including: collection of positioned blueprints (blueprint reference, x/y offset, rotation), total dimensions, aggregate input requirements (resource type, total rate, global tile coordinates), aggregate output specifications (resource type, total rate, global tile coordinates), and efficiency metrics (items per minute per tile)
- **Resource Source**: Represents a map location with available resources including: resource type (iron ore, copper ore, etc.), map coordinates (x, y), and optional extraction rate capacity
- **Blueprint Catalog Entry**: Extends Blueprint with additional metadata: creation date, usage count, efficiency rating (throughput per tile area), and validation status

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can specify a production target (item and rate) and receive accurate machine and resource requirements within 5 seconds, matching Kirk McDonald calculator results within 5% margin
- **SC-002**: Users can add a blueprint to the catalog with complete metadata in under 2 minutes
- **SC-003**: System can automatically compose a factory block for any production target using available blueprints from the catalog in under 10 seconds
- **SC-004**: Generated factory blocks achieve at least 90% spatial efficiency (production rate per tile area) compared to manually optimized designs
- **SC-005**: System successfully handles production chains requiring up to 10 levels of intermediate products without errors
- **SC-006**: Blueprint catalog search returns results in under 1 second for catalogs containing up to 1000 blueprints
- **SC-007**: 95% of composed factory blocks have properly aligned input/output connections without manual adjustment needed
- **SC-008**: Exported factory block metadata includes sufficient information for external belt routing scripts to operate without additional user input

## Assumptions

- Kirk McDonald calculator API or data format is accessible and parseable by the system
- Users have basic knowledge of Factorio blueprint strings and can extract them from the game
- Blueprint metadata (especially input/output tile positions) will be determined by users through in-game measurement or existing tools
- The system focuses on production modules only; it does not handle power generation, defense, or logistics beyond immediate belt connections
- Standard Factorio game mechanics apply (item stack sizes, belt speeds, assembler speeds) - no mods are required to be supported initially
- Tile coordinate system follows Factorio's coordinate convention (origin at blueprint center or top-left)
- Belt routing between composed modules will be handled by a separate script/tool - this system only provides the metadata needed
- Users understand units per minute as the standard measurement for production rates
- Resource sources are assumed to have unlimited capacity unless specified otherwise

## Scope

### In Scope

- Integration with Kirk McDonald calculator for production calculations
- Blueprint catalog with CRUD operations (Create, Read, Update, Delete)
- Metadata specification for blueprints (dimensions, throughput, I/O positions)
- Automated blueprint selection based on production requirements
- Factory block composition with multiple blueprint instances
- Spatial optimization to avoid overlaps and align connections
- Export of complete factory designs with routing metadata
- Resource proximity analysis for blueprint placement

### Out of Scope

- Automated belt routing between modules (handled by separate tool)
- Power grid design and electrical connection routing
- Logistics network design (roboports, logistics chests)
- Defense module placement (walls, turrets)
- Train station and rail network design
- Mod support beyond vanilla Factorio
- Real-time factory performance monitoring
- In-game integration or mod development
- Graphical user interface (system may be CLI or API-based)
- Multiplayer or shared catalog features
- Blueprint visual rendering or preview generation
