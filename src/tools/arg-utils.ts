import { ToolFunction } from './builtins.js';

/**
 * Safely parse LLM-generated JSON with automatic fixup for common errors.
 *
 * LLMs frequently produce:
 * - Single quotes instead of double quotes
 * - Trailing commas in objects/arrays
 * - Unquoted property keys
 * - Missing closing braces
 */
export function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!text || text.trim() === '') {
    return { ok: false, error: 'Empty JSON string' };
  }

  // Try native parse first
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    // Fall through to fixup
  }

  let fixed = text.trim();

  // Fix single quotes → double quotes (outside of already-double-quoted strings)
  // Match 'key': or 'value' patterns but not inside " already
  const repairs: Array<{ from: RegExp; to: string }> = [
    // Replace single-quoted keys with double-quoted
    { from: /'([^']+)'(?=\s*:)/g, to: '"$1"' },
    // Replace single-quoted string values with double-quoted
    { from: /:\s*'([^']*?)'(\s*[,}\]])/g, to: ': "$1"$2' },
    // Remove trailing commas before closing brackets/braces
    { from: /,\s*([}\]])/g, to: '$1' },
    // Remove trailing comma at end
    { from: /,\s*$/, to: '' },
    // Fix unquoted keys (simple word keys only)
    { from: /([{,]\s*)(\w[\w\d_]*)(\s*:)/g, to: '$1"$2"$3' },
  ];

  for (const { from, to } of repairs) {
    fixed = fixed.replace(from, to);
  }

  // Ensure balanced braces
  const openCurly = (fixed.match(/\{/g) || []).length;
  const closeCurly = (fixed.match(/\}/g) || []).length;
  if (openCurly > closeCurly) {
    fixed += '}'.repeat(openCurly - closeCurly);
  }
  const openBracket = (fixed.match(/\[/g) || []).length;
  const closeBracket = (fixed.match(/\]/g) || []).length;
  if (openBracket > closeBracket) {
    fixed += ']'.repeat(openBracket - closeBracket);
  }

  try {
    return { ok: true, value: JSON.parse(fixed) };
  } catch (e: any) {
    return { ok: false, error: `Failed to parse JSON after fixup: ${e.message}\nOriginal: ${text.slice(0, 200)}` };
  }
}

/**
 * Coerce a value to the expected type based on JSON schema type hint.
 * LLMs often pass numbers as strings, arrays as comma-separated strings, etc.
 */
export function coerceValue(value: unknown, expectedType: string | undefined): unknown {
  if (expectedType === 'string') {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  if (expectedType === 'number') {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.trim().replace(/[,_\s]/g, '');
      const n = Number(cleaned);
      if (!isNaN(n)) return n;
      return value; // Can't coerce, return as-is
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  }

  if (expectedType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lower)) return true;
      if (['false', '0', 'no', 'off'].includes(lower)) return false;
    }
    if (typeof value === 'number') return value !== 0;
    return value;
  }

  if (expectedType === 'array') {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (value === null || value === undefined) return [];
    return [value];
  }

  return value;
}

/**
 * Extract JSON schema property type info from a tool function definition.
 */
function getSchemaType(def: ToolFunction, propName: string): string | undefined {
  const props = def.parameters?.properties as Record<string, any> | undefined;
  if (!props) return undefined;
  const prop = props[propName];
  if (!prop) return undefined;
  return prop.type as string;
}

/**
 * Normalize tool call arguments:
 * 1. Safe-JSON parse the raw args
 * 2. Coerce types to match the tool's schema
 * 3. Remove unknown/extra fields that don't exist in schema
 */
export function normalizeArgs(
  rawArgs: Record<string, unknown>,
  def: ToolFunction,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const props = (def.parameters?.properties as Record<string, any>) || {};

  for (const [key, value] of Object.entries(rawArgs)) {
    // Skip keys not in schema
    if (!(key in props) && Object.keys(props).length > 0) {
      continue;
    }
    const expectedType = (props[key] as any)?.type;
    result[key] = coerceValue(value, expectedType);
  }

  return result;
}

/**
 * Validate tool call arguments against the schema.
 * Returns null if valid, or an error string explaining what's wrong.
 */
export function validateArgs(
  args: Record<string, unknown>,
  def: ToolFunction,
): string | null {
  const required = (def.parameters?.required as string[]) || [];
  const props = (def.parameters?.properties as Record<string, any>) || {};

  // Check required fields
  for (const key of required) {
    const val = args[key];
    if (val === undefined || val === null || val === '') {
      return `Missing required parameter "${key}" for tool "${def.name}"`;
    }
  }

  // Type check where possible
  for (const [key, value] of Object.entries(args)) {
    const prop = props[key];
    if (!prop || value === undefined || value === null) continue;
    const expectedType = prop.type as string;

    if (expectedType === 'array' && !Array.isArray(value) && typeof value !== 'string') {
      return `Parameter "${key}" should be an array, got ${typeof value}`;
    }
    if (expectedType === 'number' && typeof value === 'string') {
      const n = Number(value);
      if (isNaN(n)) {
        return `Parameter "${key}" should be a number, got "${value}"`;
      }
    }
    if (expectedType === 'boolean' && typeof value !== 'boolean' && typeof value !== 'string') {
      return `Parameter "${key}" should be a boolean, got ${typeof value}`;
    }
  }

  return null;
}
