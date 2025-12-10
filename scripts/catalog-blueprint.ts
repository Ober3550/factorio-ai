#!/usr/bin/env node
/**
 * Blueprint Catalog Management CLI Tool
 * 
 * Manages blueprint catalog with CRUD operations for metadata
 */

import path from 'path';
import { fileExists } from '../src/lib/file-utils.js';
import { createBlueprint, generateBlueprintId } from '../src/models/blueprint.js';
import type { Blueprint } from '../src/models/blueprint.js';
import {
  addBlueprint,
  getBlueprint,
  listBlueprints,
  searchBlueprints,
  updateBlueprint,
  deleteBlueprint,
  getCatalogStats,
} from '../src/services/catalog-service.js';
import type { SearchCriteria } from '../src/services/catalog-service.js';

interface ParsedArgs {
  command?: string;
  blueprint?: string;
  name?: string;
  dimensions?: string;
  'primary-output'?: string;
  input?: string[];
  output?: string[];
  tag?: string[];
  'remove-tag'?: string[];
  json?: boolean;
  id?: string;
  item?: string;
  'min-throughput'?: string;
  'max-dimensions'?: string;
  'sort-by'?: string;
  confirm?: boolean;
}

/**
 * Parse command-line arguments (custom parser for Node.js compatibility)
 */
function parseArguments(args: string[]): ParsedArgs {
  const result: ParsedArgs = {};
  const arrayFlags = ['input', 'output', 'tag', 'remove-tag'];
  
  // First non-flag argument is the command
  if (args.length > 0 && !args[0].startsWith('--')) {
    result.command = args.shift();
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const flagName = arg.substring(2);
      
      // Boolean flags
      if (flagName === 'json' || flagName === 'confirm') {
        result[flagName] = true;
        continue;
      }
      
      // Value flags
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        const value = args[i + 1];
        i++; // Skip next arg since we consumed it
        
        // Array flags (repeatable)
        if (arrayFlags.includes(flagName)) {
          if (!result[flagName as keyof ParsedArgs]) {
            (result as any)[flagName] = [];
          }
          (result as any)[flagName].push(value);
        } else {
          (result as any)[flagName] = value;
        }
      }
    }
  }
  
  return result;
}

/**
 * Parse dimensions string (e.g., "24x12")
 */
function parseDimensions(dimStr: string): { width: number; height: number } {
  const match = dimStr.match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(`Invalid dimensions format: ${dimStr}. Expected format: WIDTHxHEIGHT (e.g., 24x12)`);
  }
  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10),
  };
}

/**
 * Parse item:rate string (e.g., "iron-plate:180")
 */
function parseItemRate(itemRateStr: string): { item: string; rate: number } {
  const parts = itemRateStr.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid item:rate format: ${itemRateStr}. Expected format: ITEM:RATE (e.g., iron-plate:180)`);
  }
  return {
    item: parts[0],
    rate: parseFloat(parts[1]),
  };
}

/**
 * Parse resource:rate:x,y string (e.g., "iron-ore:180:0,6")
 */
function parseResourceRatePosition(inputStr: string): { resource: string; rate: number; position: { x: number; y: number } } {
  const parts = inputStr.split(':');
  if (parts.length !== 3) {
    throw new Error(`Invalid input format: ${inputStr}. Expected format: RESOURCE:RATE:X,Y (e.g., iron-ore:180:0,6)`);
  }
  
  const positionParts = parts[2].split(',');
  if (positionParts.length !== 2) {
    throw new Error(`Invalid position format: ${parts[2]}. Expected format: X,Y (e.g., 0,6)`);
  }
  
  return {
    resource: parts[0],
    rate: parseFloat(parts[1]),
    position: {
      x: parseInt(positionParts[0], 10),
      y: parseInt(positionParts[1], 10),
    },
  };
}

/**
 * Add blueprint to catalog
 */
async function cmdAdd(args: ParsedArgs): Promise<void> {
  // Validate required arguments
  if (!args.blueprint) {
    throw new Error('--blueprint is required');
  }
  if (!args.name) {
    throw new Error('--name is required');
  }
  if (!args.dimensions) {
    throw new Error('--dimensions is required');
  }
  if (!args['primary-output']) {
    throw new Error('--primary-output is required');
  }
  if (!args.input || args.input.length === 0) {
    throw new Error('At least one --input is required');
  }
  
  // Parse arguments
  const blueprintPath = path.resolve(args.blueprint);
  const dimensions = parseDimensions(args.dimensions);
  const primaryOutput = parseItemRate(args['primary-output']);
  const inputs = args.input.map(parseResourceRatePosition);
  const outputs = args.output ? args.output.map(parseResourceRatePosition) : [];
  const tags = args.tag || [];
  
  // If no outputs specified, use primary output as output
  if (outputs.length === 0) {
    // Find an edge position for the output (right edge, middle)
    outputs.push({
      resource: primaryOutput.item,
      rate: primaryOutput.rate,
      position: {
        x: dimensions.width - 1,
        y: Math.floor(dimensions.height / 2),
      },
    });
  }
  
  // Check if blueprint file exists
  if (!await fileExists(blueprintPath)) {
    throw new Error(`Blueprint file not found: ${blueprintPath}`);
  }
  
  // Generate blueprint ID from name
  const blueprintId = generateBlueprintId(args.name);
  
  // Determine .json file path (should exist alongside .bp file)
  const blueprintDir = path.dirname(blueprintPath);
  const blueprintBasename = path.basename(blueprintPath, '.bp');
  const blueprintJsonPath = path.join(blueprintDir, `${blueprintBasename}.json`);
  
  // Create blueprint object
  const blueprint = createBlueprint({
    id: blueprintId,
    name: args.name,
    blueprintString: blueprintPath,
    blueprintJson: blueprintJsonPath,
    dimensions,
    primaryOutput,
    inputs,
    outputs,
    tags,
  });
  
  // Add to catalog
  await addBlueprint(blueprint);
  
  // Output result
  if (args.json) {
    console.log(JSON.stringify({
      id: blueprint.id,
      status: 'added',
      metadata: blueprint,
    }, null, 2));
  } else {
    console.log(`✓ Blueprint added to catalog`);
    console.log(`  ID: ${blueprint.id}`);
    console.log(`  Name: ${blueprint.name}`);
    console.log(`  Dimensions: ${dimensions.width}x${dimensions.height}`);
    console.log(`  Primary output: ${primaryOutput.rate}/m ${primaryOutput.item}`);
    console.log(`  Efficiency: ${blueprint.efficiency.toFixed(3)}/tile`);
  }
}

/**
 * Search blueprints
 */
async function cmdSearch(args: ParsedArgs): Promise<void> {
  const criteria: SearchCriteria = {};
  
  if (args.item) {
    criteria.item = args.item;
  }
  if (args.input) {
    criteria.input = args.input[0]; // Use first input if multiple specified
  }
  if (args['min-throughput']) {
    criteria.minThroughput = parseFloat(args['min-throughput']);
  }
  if (args['max-dimensions']) {
    criteria.maxDimensions = parseDimensions(args['max-dimensions']);
  }
  if (args.tag && args.tag.length > 0) {
    criteria.tags = args.tag;
  }
  if (args['sort-by']) {
    const validSortBy = ['efficiency', 'throughput', 'size', 'name'];
    if (!validSortBy.includes(args['sort-by'])) {
      throw new Error(`Invalid --sort-by value. Must be one of: ${validSortBy.join(', ')}`);
    }
    criteria.sortBy = args['sort-by'] as any;
  }
  
  const results = await searchBlueprints(criteria);
  
  if (args.json) {
    console.log(JSON.stringify({
      query: criteria,
      results: results.map(bp => ({
        id: bp.id,
        name: bp.name,
        primaryOutput: bp.primaryOutput,
        dimensions: bp.dimensions,
        efficiency: bp.efficiency,
        tags: bp.tags,
      })),
      count: results.length,
    }, null, 2));
  } else {
    if (results.length === 0) {
      console.log('No blueprints found matching criteria.');
      return;
    }
    
    console.log(`Found ${results.length} blueprint${results.length === 1 ? '' : 's'}:\n`);
    
    results.forEach((bp, index) => {
      console.log(`${index + 1}. ${bp.id} (${bp.name})`);
      console.log(`   Output: ${bp.primaryOutput.rate}/m ${bp.primaryOutput.item}`);
      console.log(`   Dimensions: ${bp.dimensions.width}x${bp.dimensions.height} tiles`);
      console.log(`   Efficiency: ${bp.efficiency.toFixed(3)}/tile`);
      if (bp.tags.length > 0) {
        console.log(`   Tags: ${bp.tags.join(', ')}`);
      }
      console.log();
    });
  }
}

/**
 * Get blueprint details
 */
async function cmdGet(args: ParsedArgs): Promise<void> {
  if (!args.id) {
    throw new Error('--id is required');
  }
  
  const blueprint = await getBlueprint(args.id);
  
  if (!blueprint) {
    throw new Error(`Blueprint with id '${args.id}' not found`);
  }
  
  if (args.json) {
    console.log(JSON.stringify(blueprint, null, 2));
  } else {
    console.log(`Blueprint: ${blueprint.name}`);
    console.log(`ID: ${blueprint.id}`);
    console.log(`\nDimensions: ${blueprint.dimensions.width}x${blueprint.dimensions.height} tiles`);
    console.log(`Primary Output: ${blueprint.primaryOutput.rate}/m ${blueprint.primaryOutput.item}`);
    console.log(`Efficiency: ${blueprint.efficiency.toFixed(3)}/tile`);
    console.log(`\nInputs:`);
    blueprint.inputs.forEach(input => {
      console.log(`  - ${input.rate}/m ${input.resource} at (${input.position.x}, ${input.position.y})`);
    });
    console.log(`\nOutputs:`);
    blueprint.outputs.forEach(output => {
      console.log(`  - ${output.rate}/m ${output.resource} at (${output.position.x}, ${output.position.y})`);
    });
    if (blueprint.tags.length > 0) {
      console.log(`\nTags: ${blueprint.tags.join(', ')}`);
    }
    console.log(`\nUsage count: ${blueprint.usageCount}`);
    console.log(`Created: ${blueprint.createdAt}`);
    console.log(`Validated: ${blueprint.validated ? 'Yes' : 'No'}`);
  }
}

/**
 * List all blueprints
 */
async function cmdList(args: ParsedArgs): Promise<void> {
  const blueprints = await listBlueprints();
  
  if (args.json) {
    console.log(JSON.stringify(blueprints.map(bp => ({
      id: bp.id,
      name: bp.name,
      primaryOutput: bp.primaryOutput,
      dimensions: bp.dimensions,
      efficiency: bp.efficiency,
      tags: bp.tags,
    })), null, 2));
  } else {
    if (blueprints.length === 0) {
      console.log('No blueprints in catalog.');
      return;
    }
    
    const stats = await getCatalogStats();
    console.log(`Catalog contains ${stats.totalBlueprints} blueprint${stats.totalBlueprints === 1 ? '' : 's'}:\n`);
    
    blueprints.forEach((bp, index) => {
      console.log(`${index + 1}. ${bp.id} (${bp.name})`);
      console.log(`   Output: ${bp.primaryOutput.rate}/m ${bp.primaryOutput.item}`);
      console.log(`   Dimensions: ${bp.dimensions.width}x${bp.dimensions.height} tiles`);
      console.log(`   Efficiency: ${bp.efficiency.toFixed(3)}/tile`);
      console.log();
    });
  }
}

/**
 * Update blueprint metadata
 */
async function cmdUpdate(args: ParsedArgs): Promise<void> {
  if (!args.id) {
    throw new Error('--id is required');
  }
  
  const updates: any = {};
  
  if (args.name) {
    updates.name = args.name;
  }
  if (args['primary-output']) {
    updates.primaryOutput = parseItemRate(args['primary-output']);
  }
  if (args.tag && args.tag.length > 0) {
    // Get existing blueprint to merge tags
    const existing = await getBlueprint(args.id);
    if (!existing) {
      throw new Error(`Blueprint with id '${args.id}' not found`);
    }
    updates.tags = [...new Set([...existing.tags, ...args.tag])];
  }
  if (args['remove-tag'] && args['remove-tag'].length > 0) {
    const existing = await getBlueprint(args.id);
    if (!existing) {
      throw new Error(`Blueprint with id '${args.id}' not found`);
    }
    updates.tags = existing.tags.filter(tag => !args['remove-tag']!.includes(tag));
  }
  
  if (Object.keys(updates).length === 0) {
    throw new Error('At least one update field is required (--name, --primary-output, --tag, --remove-tag)');
  }
  
  const updated = await updateBlueprint(args.id, updates);
  
  if (args.json) {
    console.log(JSON.stringify({
      id: updated.id,
      status: 'updated',
      metadata: updated,
    }, null, 2));
  } else {
    console.log(`✓ Blueprint updated`);
    console.log(`  ID: ${updated.id}`);
    console.log(`  Name: ${updated.name}`);
    if (updates.primaryOutput) {
      console.log(`  Primary output: ${updated.primaryOutput.rate}/m ${updated.primaryOutput.item}`);
      console.log(`  Efficiency: ${updated.efficiency.toFixed(3)}/tile`);
    }
    if (updates.tags) {
      console.log(`  Tags: ${updated.tags.join(', ')}`);
    }
  }
}

/**
 * Delete blueprint
 */
async function cmdDelete(args: ParsedArgs): Promise<void> {
  if (!args.id) {
    throw new Error('--id is required');
  }
  if (!args.confirm) {
    throw new Error('--confirm flag is required to prevent accidental deletion');
  }
  
  await deleteBlueprint(args.id);
  
  if (args.json) {
    console.log(JSON.stringify({
      id: args.id,
      status: 'deleted',
    }, null, 2));
  } else {
    console.log(`✓ Blueprint deleted: ${args.id}`);
  }
}

/**
 * Show usage information
 */
function showUsage(): void {
  console.log(`
Blueprint Catalog Management Tool

Usage:
  npm run catalog -- <command> [options]

Commands:
  add       Add blueprint to catalog
  search    Search catalog
  get       Get blueprint details
  list      List all blueprints
  update    Update blueprint metadata
  delete    Delete blueprint

Examples:
  # Add a blueprint
  npm run catalog -- add \\
    --blueprint blueprints/smelting/smelting.bp \\
    --name "Iron Smelting Array" \\
    --dimensions 24x12 \\
    --primary-output iron-plate:180 \\
    --input iron-ore:180:0,6 \\
    --tag smelting --tag iron

  # Search for blueprints
  npm run catalog -- search --item iron-plate --min-throughput 100

  # Get blueprint details
  npm run catalog -- get --id iron-smelting-array

  # List all blueprints
  npm run catalog -- list

  # Update blueprint
  npm run catalog -- update --id iron-smelting-array --tag mid-game

  # Delete blueprint
  npm run catalog -- delete --id iron-smelting-array --confirm

Options:
  --json        Output JSON format
  --confirm     Confirm destructive operations
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  
  try {
    switch (args.command) {
      case 'add':
        await cmdAdd(args);
        break;
      case 'search':
        await cmdSearch(args);
        break;
      case 'get':
        await cmdGet(args);
        break;
      case 'list':
        await cmdList(args);
        break;
      case 'update':
        await cmdUpdate(args);
        break;
      case 'delete':
        await cmdDelete(args);
        break;
      case 'help':
      case undefined:
        showUsage();
        break;
      default:
        console.error(`Unknown command: ${args.command}`);
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
