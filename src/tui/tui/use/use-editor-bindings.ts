/**
 * `useEditorBindings` — derivational memos shared by the editor shell
 * and the picker overlays. No side effects, no state: just composed
 * memos that turn the initial config + theme + env into the values
 * the JSX tree consumes (bindings list, catalogued widget entries,
 * the translator, the set of widget types already placed, and the
 * picker-basis projection).
 */

import { useMemo } from "react";

import {
  createDictTranslator,
  createTranslator,
  type DictTranslator,
  type Translator,
} from "../../../core/i18n/index.js";
import type { AgentlineConfig } from "../../../data/config/types.js";
import type { Theme } from "../../../data/theme/index.js";
import { defaultRegistry, registerAllBuiltins, type WidgetMetaEntry } from "../../../widgets/index.js";
import { widgetVariants } from "../../../widgets/families/catalog.js";
import { listBindings, type KeyBinding } from "../../keys/index.js";

import type { PickerBasis } from "../../picker/picker.js";
import type { EditorState } from "../../state/state.js";

/** The catalogued built-in widgets, populating the default registry once. */
function builtinWidgetEntries(): readonly WidgetMetaEntry[] {
  const registry = defaultRegistry();
  if (registry.size() === 0) registerAllBuiltins(registry);
  return registry.listMeta();
}

export interface UseEditorKeyBindingsInput {
  readonly initialConfig: AgentlineConfig;
  readonly previewTheme: Theme | null;
  readonly env: NodeJS.ProcessEnv;
  readonly state: EditorState;
}

export interface UseEditorKeyBindingsResult {
  readonly bindings: readonly KeyBinding[];
  readonly widgetEntries: readonly WidgetMetaEntry[];
  /** Lower-level translator used for catalogue-driven and template-literal ids. */
  readonly t: Translator;
  /** Dictionary-bound translator for static-id surfaces (`app.*`, `picker.*`, …). */
  readonly td: DictTranslator;
  readonly usedTypes: ReadonlySet<string>;
  readonly pickerBasis: PickerBasis;
}

export function useEditorBindings(input: UseEditorKeyBindingsInput): UseEditorKeyBindingsResult {
  const { initialConfig, previewTheme, env, state } = input;

  const bindings = useMemo(
    () => listBindings(initialConfig.keymap as Record<string, string> | undefined),
    [initialConfig.keymap],
  );

  const widgetEntries = useMemo(() => builtinWidgetEntries(), []);

  const t = useMemo(() => createTranslator(initialConfig), [initialConfig]);
  const td = useMemo(() => createDictTranslator(initialConfig), [initialConfig]);

  /*
   * Types already placed in the layout. The picker hides these so the user
   * can't add the same widget twice. In replace mode the widget under the
   * cursor is on its way out — but we only let its type back into the
   * picker when the widget has variants, so users on a variant-bearing
   * widget can still swap variants via replace. For variant-less widgets,
   * re-picking the same type would be a no-op and is excluded.
   */
  const usedTypes = useMemo(() => {
    const set = new Set<string>();
    for (const line of state.lines) for (const w of line.widgets) set.add(w.type);
    /*
     * `state.pickerTarget` exists only on the picker branch of the
     * discriminated union; the mode-check narrows it for TS.
     */
    if (state.mode !== "edit" && state.pickerTarget.kind === "replace") {
      const line = state.lines[state.pickerTarget.line];
      const target = line?.widgets[state.pickerTarget.index];
      if (target && widgetVariants(target.type).length > 0) {
        set.delete(target.type);
      }
    }
    return set;
  }, [state]);

  /*
   * The resolved render basis shared by every picker view — the same
   * `{ config, theme, env }` the live statusline and the editor preview
   * render through, so picker chrome and previews match `agentline
   * render` exactly (incl. custom themes and `config.families`).
   */
  const pickerBasis = useMemo(
    () => ({ config: initialConfig, theme: previewTheme, env }),
    [initialConfig, previewTheme, env],
  );

  return { bindings, widgetEntries, t, td, usedTypes, pickerBasis };
}
