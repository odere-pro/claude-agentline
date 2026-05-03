/**
 * Widget registry (§7.1).
 *
 * Owns the mapping from `type` string to widget implementation. The
 * built-in widgets (PRs 10–14) register themselves at module-load
 * time; tests may pass an isolated registry instance to avoid global
 * coupling.
 *
 * The registry is intentionally narrow: lookup, register, list, has.
 * Custom widget plugins via dynamic libraries are out of scope for
 * v0.1.0 (§13).
 */

import type { WidgetDef } from "./widget.js";

export class WidgetTypeAlreadyRegistered extends Error {
  constructor(public readonly type: string) {
    super(`agentline: widget type already registered: ${type}`);
    this.name = "WidgetTypeAlreadyRegistered";
  }
}

export class WidgetTypeNotRegistered extends Error {
  constructor(public readonly type: string) {
    super(`agentline: widget type not registered: ${type}`);
    this.name = "WidgetTypeNotRegistered";
  }
}

export class WidgetRegistry {
  private readonly defs = new Map<string, WidgetDef>();

  register<T>(def: WidgetDef<T>): void {
    if (this.defs.has(def.type)) {
      throw new WidgetTypeAlreadyRegistered(def.type);
    }
    this.defs.set(def.type, def as WidgetDef);
  }

  registerAll(defs: readonly WidgetDef<unknown>[]): void {
    for (const def of defs) this.register(def);
  }

  get(type: string): WidgetDef | undefined {
    return this.defs.get(type);
  }

  require(type: string): WidgetDef {
    const def = this.defs.get(type);
    if (!def) throw new WidgetTypeNotRegistered(type);
    return def;
  }

  has(type: string): boolean {
    return this.defs.has(type);
  }

  list(): readonly string[] {
    return [...this.defs.keys()].sort();
  }

  size(): number {
    return this.defs.size;
  }
}

let defaultInstance: WidgetRegistry | null = null;

export function defaultRegistry(): WidgetRegistry {
  if (!defaultInstance) defaultInstance = new WidgetRegistry();
  return defaultInstance;
}

export function resetDefaultRegistry(): void {
  defaultInstance = null;
}
