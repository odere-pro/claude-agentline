/**
 * The JSON Schema (`schemas/config.schema.json`) is embedded at build time.
 *
 * tsup's `loader` option turns a `.json` import into an ESM default export,
 * so this file is the single re-export point. Keeping the import here means
 * code paths importing the schema (validator, `agentline config schema` command,
 * docs generator) all read the same bytes.
 */

import schema from "../../schemas/config.schema.json" with { type: "json" };

export const CONFIG_SCHEMA = schema as Record<string, unknown>;

export function configSchemaJson(indent = 2): string {
  return `${JSON.stringify(CONFIG_SCHEMA, null, indent)}\n`;
}
