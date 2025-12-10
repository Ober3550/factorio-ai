/**
 * Blueprint catalog service
 * 
 * Manages CRUD operations for blueprint catalog with in-memory indexing
 * for fast search and retrieval
 */

import path from 'path';
import type { Blueprint } from '../models/blueprint.js';
import { validateBlueprint, calculateEfficiency } from '../models/blueprint.js';
import { readJsonFile, writeJsonFile, fileExists, listFiles, deleteFile } from '../lib/file-utils.js';

export interface SearchCriteria {
  item?: string;           // Filter by produced item
  input?: string;          // Filter by required input resource
  minThroughput?: number;  // Minimum primary output rate
  maxDimensions?: { width: number; height: number };
  tags?: string[];         // Filter by tags (OR logic)
  sortBy?: 'efficiency' | 'throughput' | 'size' | 'name';
}

export interface CatalogIndex {
  byId: Map<string, Blueprint>;
  byItem: Map<string, Blueprint[]>;
  byInput: Map<string, Blueprint[]>;
  lastUpdated: Date;
}

let catalogIndex: CatalogIndex | null = null;

/**
 * Get the base directory for blueprint metadata files
 */
export function getBaseBlueprintsDir(): string {
  return path.resolve(process.cwd(), 'blueprints');
}

/**
 * Get the metadata file path for a blueprint
 */
export function getMetadataPath(blueprintId: string, blueprintName?: string): string {
  const basePath = getBaseBlueprintsDir();
  
  // Try to find existing metadata file
  if (catalogIndex) {
    const existing = catalogIndex.byId.get(blueprintId);
    if (existing) {
      return path.join(basePath, blueprintId, `${blueprintId}.metadata.json`);
    }
  }
  
  // For new blueprints, use the blueprint ID as directory name
  return path.join(basePath, blueprintId, `${blueprintId}.metadata.json`);
}

/**
 * Recursively find all .metadata.json files
 */
async function findMetadataFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];
  
  try {
    const entries = await import('fs/promises').then(fs => fs.readdir(dirPath, { withFileTypes: true }));
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await findMetadataFiles(fullPath);
        results.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.metadata.json')) {
        results.push(fullPath);
      }
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.warn(`Error reading directory ${dirPath}:`, error);
    }
  }
  
  return results;
}

/**
 * Build in-memory index of all blueprints
 */
async function buildIndex(): Promise<CatalogIndex> {
  const index: CatalogIndex = {
    byId: new Map(),
    byItem: new Map(),
    byInput: new Map(),
    lastUpdated: new Date(),
  };
  
  const basePath = getBaseBlueprintsDir();
  
  if (!await fileExists(basePath)) {
    return index;
  }
  
  // Find all .metadata.json files recursively
  const metadataFiles = await findMetadataFiles(basePath);
  
  for (const metadataFile of metadataFiles) {
    try {
      const data = await readJsonFile(metadataFile);
      const validation = validateBlueprint(data);
      
      if (validation.valid) {
        const blueprint = validation.data;
        
        // Index by ID
        index.byId.set(blueprint.id, blueprint);
        
        // Index by primary output item
        const item = blueprint.primaryOutput.item;
        if (!index.byItem.has(item)) {
          index.byItem.set(item, []);
        }
        index.byItem.get(item)!.push(blueprint);
        
        // Index by input resources
        for (const input of blueprint.inputs) {
          if (!index.byInput.has(input.resource)) {
            index.byInput.set(input.resource, []);
          }
          index.byInput.get(input.resource)!.push(blueprint);
        }
      }
    } catch (error) {
      console.warn(`Failed to load blueprint from ${metadataFile}:`, error);
    }
  }
  
  return index;
}

/**
 * Get or build the catalog index
 */
async function getIndex(): Promise<CatalogIndex> {
  if (!catalogIndex) {
    catalogIndex = await buildIndex();
  }
  return catalogIndex;
}

/**
 * Clear the catalog index (force rebuild on next access)
 */
export function clearIndex(): void {
  catalogIndex = null;
}

/**
 * Add a new blueprint to the catalog
 */
export async function addBlueprint(blueprint: Blueprint): Promise<void> {
  // Validate blueprint
  const validation = validateBlueprint(blueprint);
  if (!validation.valid) {
    throw new Error(`Invalid blueprint: ${validation.errors.join(', ')}`);
  }
  
  // Check for duplicate ID
  const index = await getIndex();
  if (index.byId.has(blueprint.id)) {
    throw new Error(`Blueprint with id '${blueprint.id}' already exists`);
  }
  
  // Write metadata file
  const metadataPath = getMetadataPath(blueprint.id);
  await writeJsonFile(metadataPath, blueprint);
  
  // Update index
  index.byId.set(blueprint.id, blueprint);
  
  const item = blueprint.primaryOutput.item;
  if (!index.byItem.has(item)) {
    index.byItem.set(item, []);
  }
  index.byItem.get(item)!.push(blueprint);
  
  for (const input of blueprint.inputs) {
    if (!index.byInput.has(input.resource)) {
      index.byInput.set(input.resource, []);
    }
    index.byInput.get(input.resource)!.push(blueprint);
  }
}

/**
 * Get a blueprint by ID
 */
export async function getBlueprint(id: string): Promise<Blueprint | null> {
  const index = await getIndex();
  return index.byId.get(id) || null;
}

/**
 * List all blueprints
 */
export async function listBlueprints(): Promise<Blueprint[]> {
  const index = await getIndex();
  return Array.from(index.byId.values());
}

/**
 * Search blueprints by criteria
 */
export async function searchBlueprints(criteria: SearchCriteria): Promise<Blueprint[]> {
  const index = await getIndex();
  let results: Blueprint[] = [];
  
  // Start with all blueprints or filter by item/input if specified
  if (criteria.item) {
    results = index.byItem.get(criteria.item) || [];
  } else if (criteria.input) {
    results = index.byInput.get(criteria.input) || [];
  } else {
    results = Array.from(index.byId.values());
  }
  
  // Apply additional filters
  results = results.filter(bp => {
    // Filter by item (if both item and input specified)
    if (criteria.item && bp.primaryOutput.item !== criteria.item) {
      return false;
    }
    
    // Filter by input (if both item and input specified)
    if (criteria.input && !bp.inputs.some(i => i.resource === criteria.input)) {
      return false;
    }
    
    // Filter by minimum throughput
    if (criteria.minThroughput !== undefined && bp.primaryOutput.rate < criteria.minThroughput) {
      return false;
    }
    
    // Filter by maximum dimensions
    if (criteria.maxDimensions) {
      if (bp.dimensions.width > criteria.maxDimensions.width ||
          bp.dimensions.height > criteria.maxDimensions.height) {
        return false;
      }
    }
    
    // Filter by tags (OR logic)
    if (criteria.tags && criteria.tags.length > 0) {
      const hasTag = criteria.tags.some(tag => bp.tags.includes(tag));
      if (!hasTag) {
        return false;
      }
    }
    
    return true;
  });
  
  // Sort results
  if (criteria.sortBy) {
    results.sort((a, b) => {
      switch (criteria.sortBy) {
        case 'efficiency':
          return b.efficiency - a.efficiency;
        case 'throughput':
          return b.primaryOutput.rate - a.primaryOutput.rate;
        case 'size':
          return (a.dimensions.width * a.dimensions.height) - (b.dimensions.width * b.dimensions.height);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }
  
  return results;
}

/**
 * Update blueprint metadata
 */
export async function updateBlueprint(id: string, updates: Partial<Pick<Blueprint, 'name' | 'primaryOutput' | 'tags'>>): Promise<Blueprint> {
  const index = await getIndex();
  const blueprint = index.byId.get(id);
  
  if (!blueprint) {
    throw new Error(`Blueprint with id '${id}' not found`);
  }
  
  // Apply updates
  const updated: Blueprint = {
    ...blueprint,
    ...updates,
  };
  
  // Recalculate efficiency if primary output changed
  if (updates.primaryOutput) {
    updated.efficiency = calculateEfficiency(updated);
  }
  
  // Validate updated blueprint
  const validation = validateBlueprint(updated);
  if (!validation.valid) {
    throw new Error(`Invalid blueprint after update: ${validation.errors.join(', ')}`);
  }
  
  // Write updated metadata
  const metadataPath = getMetadataPath(id);
  await writeJsonFile(metadataPath, updated);
  
  // Update index
  index.byId.set(id, updated);
  
  // Update item index if primary output changed
  if (updates.primaryOutput) {
    // Remove from old item index
    const oldItem = blueprint.primaryOutput.item;
    if (index.byItem.has(oldItem)) {
      const blueprints = index.byItem.get(oldItem)!;
      const idx = blueprints.findIndex(bp => bp.id === id);
      if (idx !== -1) {
        blueprints.splice(idx, 1);
      }
    }
    
    // Add to new item index
    const newItem = updated.primaryOutput.item;
    if (!index.byItem.has(newItem)) {
      index.byItem.set(newItem, []);
    }
    index.byItem.get(newItem)!.push(updated);
  } else {
    // Just update the reference in item index
    const item = updated.primaryOutput.item;
    if (index.byItem.has(item)) {
      const blueprints = index.byItem.get(item)!;
      const idx = blueprints.findIndex(bp => bp.id === id);
      if (idx !== -1) {
        blueprints[idx] = updated;
      }
    }
  }
  
  return updated;
}

/**
 * Delete a blueprint from the catalog
 */
export async function deleteBlueprint(id: string): Promise<void> {
  const index = await getIndex();
  const blueprint = index.byId.get(id);
  
  if (!blueprint) {
    throw new Error(`Blueprint with id '${id}' not found`);
  }
  
  // Delete metadata file
  const metadataPath = getMetadataPath(id);
  await deleteFile(metadataPath);
  
  // Remove from index
  index.byId.delete(id);
  
  // Remove from item index
  const item = blueprint.primaryOutput.item;
  if (index.byItem.has(item)) {
    const blueprints = index.byItem.get(item)!;
    const idx = blueprints.findIndex(bp => bp.id === id);
    if (idx !== -1) {
      blueprints.splice(idx, 1);
    }
  }
  
  // Remove from input index
  for (const input of blueprint.inputs) {
    if (index.byInput.has(input.resource)) {
      const blueprints = index.byInput.get(input.resource)!;
      const idx = blueprints.findIndex(bp => bp.id === id);
      if (idx !== -1) {
        blueprints.splice(idx, 1);
      }
    }
  }
}

/**
 * Increment usage count for a blueprint
 */
export async function incrementUsageCount(id: string): Promise<void> {
  const blueprint = await getBlueprint(id);
  if (!blueprint) {
    throw new Error(`Blueprint with id '${id}' not found`);
  }
  
  await updateBlueprint(id, {
    ...blueprint,
    usageCount: blueprint.usageCount + 1,
  } as any);
}

/**
 * Get catalog statistics
 */
export async function getCatalogStats(): Promise<{
  totalBlueprints: number;
  totalItems: number;
  totalInputResources: number;
}> {
  const index = await getIndex();
  
  return {
    totalBlueprints: index.byId.size,
    totalItems: index.byItem.size,
    totalInputResources: index.byInput.size,
  };
}
