/**
 * Blueprint data model and validation utilities
 * 
 * Represents a reusable factory module with spatial and throughput metadata
 */

export interface Blueprint {
  // Identity
  id: string;
  name: string;
  
  // Blueprint data (file paths)
  blueprintString: string;  // Path to .bp file
  blueprintJson: string;    // Path to .json file
  
  // Spatial metadata
  dimensions: {
    width: number;
    height: number;
  };
  
  // Production metadata
  primaryOutput: {
    item: string;
    rate: number;
  };
  
  // Inputs (multiple allowed)
  inputs: Array<{
    resource: string;
    rate: number;
    position: {
      x: number;
      y: number;
    };
  }>;
  
  // Outputs (multiple allowed)
  outputs: Array<{
    resource: string;
    rate: number;
    position: {
      x: number;
      y: number;
    };
  }>;
  
  // Categorization
  tags: string[];
  
  // Quality metrics
  efficiency: number;  // Rate per tile area (auto-calculated)
  
  // Metadata
  createdAt: string;
  usageCount: number;
  validated: boolean;
}

export interface ValidationError {
  valid: false;
  errors: string[];
}

export interface ValidationSuccess {
  valid: true;
  data: Blueprint;
}

export type ValidationResult = ValidationSuccess | ValidationError;

/**
 * Calculate efficiency metric (items per minute per tile)
 */
export function calculateEfficiency(blueprint: Blueprint): number {
  const area = blueprint.dimensions.width * blueprint.dimensions.height;
  if (area <= 0) return 0;
  return blueprint.primaryOutput.rate / area;
}

/**
 * Validate blueprint data structure
 */
export function validateBlueprint(data: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Blueprint must be an object'] };
  }
  
  const bp = data as Partial<Blueprint>;
  
  // Required string fields
  if (!bp.id || typeof bp.id !== 'string') {
    errors.push('id is required and must be a string');
  }
  if (!bp.name || typeof bp.name !== 'string') {
    errors.push('name is required and must be a string');
  }
  if (!bp.blueprintString || typeof bp.blueprintString !== 'string') {
    errors.push('blueprintString is required and must be a string');
  }
  if (!bp.blueprintJson || typeof bp.blueprintJson !== 'string') {
    errors.push('blueprintJson is required and must be a string');
  }
  
  // Dimensions validation
  if (!bp.dimensions || typeof bp.dimensions !== 'object') {
    errors.push('dimensions is required and must be an object');
  } else {
    if (typeof bp.dimensions.width !== 'number' || bp.dimensions.width <= 0 || !Number.isInteger(bp.dimensions.width)) {
      errors.push('dimensions.width must be a positive integer');
    }
    if (typeof bp.dimensions.height !== 'number' || bp.dimensions.height <= 0 || !Number.isInteger(bp.dimensions.height)) {
      errors.push('dimensions.height must be a positive integer');
    }
  }
  
  // Primary output validation
  if (!bp.primaryOutput || typeof bp.primaryOutput !== 'object') {
    errors.push('primaryOutput is required and must be an object');
  } else {
    if (!bp.primaryOutput.item || typeof bp.primaryOutput.item !== 'string') {
      errors.push('primaryOutput.item is required and must be a string');
    }
    if (typeof bp.primaryOutput.rate !== 'number' || bp.primaryOutput.rate <= 0) {
      errors.push('primaryOutput.rate must be a positive number');
    }
  }
  
  // Inputs validation
  if (!Array.isArray(bp.inputs)) {
    errors.push('inputs is required and must be an array');
  } else {
    bp.inputs.forEach((input, index) => {
      if (!input.resource || typeof input.resource !== 'string') {
        errors.push(`inputs[${index}].resource is required and must be a string`);
      }
      if (typeof input.rate !== 'number' || input.rate <= 0) {
        errors.push(`inputs[${index}].rate must be a positive number`);
      }
      if (!input.position || typeof input.position !== 'object') {
        errors.push(`inputs[${index}].position is required and must be an object`);
      } else {
        if (typeof input.position.x !== 'number' || !Number.isInteger(input.position.x)) {
          errors.push(`inputs[${index}].position.x must be an integer`);
        }
        if (typeof input.position.y !== 'number' || !Number.isInteger(input.position.y)) {
          errors.push(`inputs[${index}].position.y must be an integer`);
        }
        
        // Validate position is within bounds
        if (bp.dimensions && typeof bp.dimensions.width === 'number' && typeof bp.dimensions.height === 'number') {
          if (input.position.x < 0 || input.position.x >= bp.dimensions.width) {
            errors.push(`inputs[${index}].position.x must be within [0, ${bp.dimensions.width - 1}]`);
          }
          if (input.position.y < 0 || input.position.y >= bp.dimensions.height) {
            errors.push(`inputs[${index}].position.y must be within [0, ${bp.dimensions.height - 1}]`);
          }
        }
      }
    });
  }
  
  // Outputs validation
  if (!Array.isArray(bp.outputs)) {
    errors.push('outputs is required and must be an array');
  } else {
    bp.outputs.forEach((output, index) => {
      if (!output.resource || typeof output.resource !== 'string') {
        errors.push(`outputs[${index}].resource is required and must be a string`);
      }
      if (typeof output.rate !== 'number' || output.rate <= 0) {
        errors.push(`outputs[${index}].rate must be a positive number`);
      }
      if (!output.position || typeof output.position !== 'object') {
        errors.push(`outputs[${index}].position is required and must be an object`);
      } else {
        if (typeof output.position.x !== 'number' || !Number.isInteger(output.position.x)) {
          errors.push(`outputs[${index}].position.x must be an integer`);
        }
        if (typeof output.position.y !== 'number' || !Number.isInteger(output.position.y)) {
          errors.push(`outputs[${index}].position.y must be an integer`);
        }
        
        // Validate position is within bounds
        if (bp.dimensions && typeof bp.dimensions.width === 'number' && typeof bp.dimensions.height === 'number') {
          if (output.position.x < 0 || output.position.x >= bp.dimensions.width) {
            errors.push(`outputs[${index}].position.x must be within [0, ${bp.dimensions.width - 1}]`);
          }
          if (output.position.y < 0 || output.position.y >= bp.dimensions.height) {
            errors.push(`outputs[${index}].position.y must be within [0, ${bp.dimensions.height - 1}]`);
          }
        }
      }
    });
  }
  
  // Check for overlapping input/output positions
  if (Array.isArray(bp.inputs) && Array.isArray(bp.outputs)) {
    const positions = new Set<string>();
    
    for (const input of bp.inputs) {
      if (input.position) {
        const key = `${input.position.x},${input.position.y}`;
        if (positions.has(key)) {
          errors.push(`Duplicate position at (${input.position.x}, ${input.position.y})`);
        }
        positions.add(key);
      }
    }
    
    for (const output of bp.outputs) {
      if (output.position) {
        const key = `${output.position.x},${output.position.y}`;
        if (positions.has(key)) {
          errors.push(`Duplicate position at (${output.position.x}, ${output.position.y})`);
        }
        positions.add(key);
      }
    }
  }
  
  // Tags validation
  if (!Array.isArray(bp.tags)) {
    errors.push('tags is required and must be an array');
  } else {
    bp.tags.forEach((tag, index) => {
      if (typeof tag !== 'string') {
        errors.push(`tags[${index}] must be a string`);
      }
    });
  }
  
  // Efficiency validation (should be auto-calculated but check if present)
  if (typeof bp.efficiency !== 'number' || bp.efficiency < 0) {
    errors.push('efficiency must be a non-negative number');
  }
  
  // Metadata validation
  if (!bp.createdAt || typeof bp.createdAt !== 'string') {
    errors.push('createdAt is required and must be a string');
  } else {
    // Validate ISO 8601 format
    const date = new Date(bp.createdAt);
    if (isNaN(date.getTime())) {
      errors.push('createdAt must be a valid ISO 8601 timestamp');
    }
  }
  
  if (typeof bp.usageCount !== 'number' || bp.usageCount < 0 || !Number.isInteger(bp.usageCount)) {
    errors.push('usageCount must be a non-negative integer');
  }
  
  if (typeof bp.validated !== 'boolean') {
    errors.push('validated is required and must be a boolean');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, data: bp as Blueprint };
}

/**
 * Create a new blueprint with calculated fields
 */
export function createBlueprint(params: Omit<Blueprint, 'efficiency' | 'createdAt' | 'usageCount' | 'validated'>): Blueprint {
  const blueprint: Blueprint = {
    ...params,
    efficiency: 0,  // Will be calculated below
    createdAt: new Date().toISOString(),
    usageCount: 0,
    validated: false,
  };
  
  // Calculate efficiency
  blueprint.efficiency = calculateEfficiency(blueprint);
  
  return blueprint;
}

/**
 * Generate a slug-style ID from a name
 */
export function generateBlueprintId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
