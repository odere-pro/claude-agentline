/**
 * Keymap module entry point (§5.5).
 *
 * Public surface: the default binding table, a `listBindings` helper
 * that applies user overrides from `config.keymap`, and the
 * `KeyBinding` / `KeyScope` types for downstream consumers (TUI
 * footer + gate-17 coverage check).
 */

export { DEFAULT_KEY_BINDINGS, listBindings, type KeyBinding, type KeyScope } from "./bindings.js";
