/**
 * The authored-English source of truth for every static-id UI surface.
 *
 * One file, one entry per id. Grouped by namespace for readability;
 * keys are dotted lower-kebab and must start with a prefix listed in
 * `I18N_NAMESPACES` (`./ids.ts`). gate-26 enforces both invariants.
 *
 * **What lives here:** app chrome, picker chrome, footer keybinding
 * verbs, family display names, and CLI command output (`cmd.*`).
 *
 * **What does NOT live here:** widget catalogue strings
 * (`widget.<type>.name` / `.desc` / `.variant.<id>` / `widget.label.*`).
 * Those author their English in `src/widgets/catalog/<family>.ts` and
 * `src/widgets/<family>/...` because the catalogue is itself a
 * dictionary keyed by widget type — duplicating those strings would
 * create two sources of truth.
 *
 * To add or change a string: edit the value here. Call sites use
 * `createDictTranslator(config)` and `t(id, vars?)` to read it; locale
 * tables under `config.translations[<lang>]` target the same ids.
 */

export const EN_DICTIONARY = {
  // ── app.* — editor chrome ──────────────────────────────────────────────
  "app.title": "agentline edit",
  "app.editing": "editing {path}",
  "app.no-widget": "(+ add widget)",
  "app.selected": "selected: {label}",
  "app.unsaved": " ● unsaved changes — press s to save, q/Esc to discard ",
  "app.saved": "saved → {path} — preview updated · will render on your next Claude Code prompt",
  "app.save-failed": "save failed: {message}",

  // ── picker.* — picker chrome ───────────────────────────────────────────
  "picker.filter": "filter",
  "picker.search": "search",
  "picker.match-count": "{n} match{es}",
  "picker.widget-count": "{n} widget{s}",
  "picker.no-match": "  (no widgets match)",
  "picker.all-placed": "  (every widget is already placed)",
  "picker.group.title": "Pick a group",
  "picker.group.hint": "{n} group{s} · ↑↓ navigate · ↵ select · / search · Esc cancel",
  "picker.group.widgets-suffix": " widget{s}",
  "picker.widget.title": "Pick a widget — group ",
  "picker.widget.hint": "{c} · type to filter · ↑↓ navigate · ↵ select · Esc back",
  "picker.search.title": "Pick a widget",
  "picker.search.hint": "{c} · type to filter · ↑↓ navigate · ↵ select · Esc back",
  "picker.search.hint-querying": "{c} · ⌫ clear · ↑↓ navigate · ↵ select · Esc back",
  "picker.variant.title": "Pick a variant — ‹{type}›",
  "picker.variant.hint": "↑↓ navigate · ↵ select · Esc back",
  "picker.variant.keep": "Keep current options",
  "picker.variant.default": "Default options",

  // ── family.* — family display names in the picker group browser ───────
  "family.session.name": "session",
  "family.tokens.name": "tokens",
  "family.context.name": "context",
  "family.rate-limits.name": "rate-limits",
  "family.git.name": "git",
  "family.other.name": "other",

  // ── footer.* — keybinding verbs for the editor footer ─────────────────
  "footer.move-cursor": "move",
  "footer.move-cursor-row": "row",
  "footer.move-widget": "move widget",
  "footer.move-widget-row": "widget→row",
  "footer.add": "add",
  "footer.replace": "replace",
  "footer.delete": "delete",
  "footer.save": "save",
  "footer.picker-filter": "type to filter",
  "footer.picker-search": "search",
  "footer.picker-navigate": "navigate",
  "footer.picker-confirm": "confirm",
  "footer.picker-back": "back",
  "footer.quit": "quit",

  // ── cmd.doctor.* — doctor check titles, messages, hints ───────────────
  "cmd.doctor.d01.title": "Claude Code settings file present",
  "cmd.doctor.d01.found": "found {path}",
  "cmd.doctor.d01.missing": "{path} is missing",
  "cmd.doctor.d01.hint-scaffold": "run `agentline doctor --fix` to scaffold an empty settings file",

  "cmd.doctor.d02.title": "statusLine wired to agentline",
  "cmd.doctor.d02.settings-missing": "Claude Code settings file is missing or unreadable",
  "cmd.doctor.d02.settings-not-object": "Claude Code settings file is not a JSON object",
  "cmd.doctor.d02.hint-fix-d01": "fix D01 first, then run `agentline doctor --fix`",
  "cmd.doctor.d02.no-statusline": "settings.json has no `statusLine` entry",
  "cmd.doctor.d02.hint-wire":
    "run `agentline doctor --fix` to wire `npx -y @odere-pro/agentline render`",
  "cmd.doctor.d02.no-command": "`statusLine.command` is missing or not a string",
  "cmd.doctor.d02.hint-overwrite":
    "run `agentline doctor --fix` to overwrite with a working invocation",
  "cmd.doctor.d02.other-tool": "`statusLine.command` does not reference agentline ({cmd})",
  "cmd.doctor.d02.hint-other-tool":
    "another statusline tool is wired up; --fix will not overwrite without --force",
  "cmd.doctor.d02.ok": "command: {cmd}",

  "cmd.doctor.d03.title": "User config matches schema",
  "cmd.doctor.d03.ok": "merged config validated",
  "cmd.doctor.d03.hint":
    "edit the offending file or run `agentline doctor --fix` to write defaults",

  "cmd.doctor.d04.title": "Referenced themes installed",
  "cmd.doctor.d04.none": "no theme referenced",
  "cmd.doctor.d04.ok": "themes ok: {themes}",
  "cmd.doctor.d04.missing": "missing themes: {themes}",
  "cmd.doctor.d04.hint": "run `agentline doctor --fix` to copy them from the bundled set",

  "cmd.doctor.d05.title": "git on PATH",
  "cmd.doctor.d05.skipped": "no git widget enabled — skipped",
  "cmd.doctor.d05.ok": "git binary resolved",
  "cmd.doctor.d05.failed": "`git --version` failed",
  "cmd.doctor.d05.hint": "install git or remove git-* widgets from your config",

  "cmd.doctor.d06.title": "Config directory writable",
  "cmd.doctor.d06.hint":
    "chown/chmod the directory so `agentline edit` / `doctor --fix` can persist config and themes",

  "cmd.doctor.d07.title": "Update check",
  "cmd.doctor.d07.no-cache": "no cached check yet (current: {current})",
  "cmd.doctor.d07.hint-no-cache":
    "run `agentline install` or `agentline edit` to populate the cache",
  "cmd.doctor.d07.last-failed": "last probe failed; running {current}",
  "cmd.doctor.d07.available": "update available: {current} → {latest}",
  "cmd.doctor.d07.hint-available": "npm i -g @odere-pro/agentline",
  "cmd.doctor.d07.up-to-date": "up to date ({current})",

  "cmd.doctor.d08.title": "Render dry-run matches snapshot",
  "cmd.doctor.d08.ok": "render fixture ok",
  "cmd.doctor.d08.hint-drift":
    "the bin's render path drifted from the embedded snapshot — investigate src/cli.ts and src/render/",

  "cmd.doctor.d09.title": "Refresh interval synced",
  "cmd.doctor.d09.no-config": "config not loaded — see D03",
  "cmd.doctor.d09.no-settings": "no readable settings.json — see D01/D02",
  "cmd.doctor.d09.not-wired": "statusLine not wired to agentline — see D02",
  "cmd.doctor.d09.disabled-ok": "disabled (0) — settings.json has no refreshInterval",
  "cmd.doctor.d09.disabled-mismatch":
    "config disables refresh (0) but settings.json has refreshInterval={actual}",
  "cmd.doctor.d09.hint-disabled-mismatch":
    "run `agentline doctor --fix` to remove it (or `agentline config refresh <seconds>`)",
  "cmd.doctor.d09.synced": "statusLine.refreshInterval = {expected}s",
  "cmd.doctor.d09.mismatch-none":
    "config sets refreshInterval={expected} but settings.json has none",
  "cmd.doctor.d09.mismatch":
    "config sets refreshInterval={expected} but settings.json has {actual}",
  "cmd.doctor.d09.hint-mismatch": "run `agentline doctor --fix` to sync it from your config",

  "cmd.doctor.d10.title": "Claude CLI health",
  "cmd.doctor.d10.not-detected": "claude CLI not detected — no cached probe yet",
  "cmd.doctor.d10.hint-not-detected":
    "ensure `claude` is on PATH; the widgets populate after the next render",
  "cmd.doctor.d10.cli-missing": "claude CLI not found on PATH",
  "cmd.doctor.d10.hint-cli-missing":
    "install the Claude Code CLI, or ignore if you run it elsewhere",
  "cmd.doctor.d10.update-available": "Claude CLI update available: {current} → {latest}",
  "cmd.doctor.d10.hint-update": "run `claude update` (or your package manager) to upgrade",
  "cmd.doctor.d10.up-to-date": "Claude CLI up to date ({current})",
  "cmd.doctor.d10.doctor-healthy": "claude doctor: healthy",
  "cmd.doctor.d10.doctor-warn": "claude doctor: {warnings} warning(s)",
  "cmd.doctor.d10.doctor-fail": "claude doctor: {issues} issue(s), {warnings} warning(s)",
  "cmd.doctor.d10.hint-doctor": "run `claude doctor` for details",

  "cmd.doctor.d11.title": "Widget config sanity",
  "cmd.doctor.d11.no-config": "config not loaded — see D03",
  "cmd.doctor.d11.ok": "{n} widget{s}, all renderable",
  "cmd.doctor.d11.unknown-types":
    "unknown widget type{s} (removed or mistyped): {types} — will render as hidden",
  "cmd.doctor.d11.hint-unknown":
    "remove or replace them with `agentline edit`, or delete the entries from your config",
  "cmd.doctor.d12.title": "Widget option validity",
  "cmd.doctor.d12.no-config": "config not loaded — see D03",
  "cmd.doctor.d12.ok": "all widget options recognised",
  "cmd.doctor.d12.unknown": "unrecognised or out-of-range widget option{s} — {details}",
  "cmd.doctor.d12.hint":
    "fix or remove the option with `agentline edit`; the widget still renders, the stray option just has no effect",

  // ── cmd.install.*, cmd.uninstall.*, cmd.reset.* — verb help blocks ────
  "cmd.install.help": `agentline install — wire @odere-pro/agentline into Claude Code's statusline

Usage:
  agentline install [--from-source] [--force] [--dry-run]

Options:
  --from-source   npm link from the local checkout instead of installing from
                  the registry. Use when developing agentline itself.
  --force         Back-compat alias; install always backs up and overwrites
                  a foreign statusLine (uninstall restores it).
  --dry-run       Print every action that would be taken; touch nothing.
  -h, --help      Show this message.

Steps performed:
  1. Install @odere-pro/agentline globally (or npm link with --from-source).
  2. Seed user config from the default template (preserves existing).
  3. Seed shipped themes into the user themes directory.
  4. Install agentline skill files into $HOME/.claude/agents/.
  5. Wire statusLine into $HOME/.claude/settings.json.
  6. Write install manifest to track managed files.
`,
  "cmd.install.next-steps":
    "Your statusline is wired. Restart Claude Code to see it at the bottom of the prompt.\n" +
    "\n" +
    "Next steps:\n" +
    "  `agentline edit`       customize your statusline\n" +
    "  `agentline uninstall`  remove agentline\n" +
    "\n" +
    "Tip: an `xhigh` reasoning effort shows as `ultracode` by default — pick the\n" +
    "`literal` variant on the thinking-effort widget (`agentline edit`) to keep the raw label.",
  "cmd.uninstall.help": `agentline uninstall — remove agentline from this host

Usage:
  agentline uninstall [--purge] [--dry-run]

Options:
  --purge     Also remove user-edited config files, themes, and skills.
  --dry-run   Print every action that would be taken; touch nothing.
  -h, --help  Show this message.

Steps performed:
  1. npm uninstall -g @odere-pro/agentline.
  2. Remove shipped themes that are byte-identical to the bundled originals.
  3. Remove seeded user config if unchanged (or always with --purge).
  4. Remove agentline skill files from $HOME/.claude/agents/ if unchanged.
  5. Restore statusLine in Claude Code settings to its pre-install state.

Idempotent. Safe to re-run. User-edited skills are preserved unless --purge.
`,
  "cmd.reset.help": `agentline reset — restore agentline to its default state

Usage:
  agentline reset [--from-source] [--force] [--dry-run]

Resets the user config to the shipped default template (overwriting your
edits), re-seeds themes and skills, and ensures the Claude Code statusLine
is wired. If agentline is not yet set up on this host, reset performs the
first-time wiring too.

Options:
  --from-source   npm link from the local checkout instead of the registry.
  --force         Overwrite a non-agentline statusLine value.
  --dry-run       Print every action that would be taken; touch nothing.
  -h, --help      Show this message.

Your config.json IS overwritten. Themes/skills you edited and any
pre-install statusLine backup are preserved.
`,
  "cmd.start.help": `agentline start — use the installed version with your existing config

Usage:
  agentline start [--from-source] [--force] [--dry-run] [--no-preview]

Re-wires the Claude Code statusLine to the installed agentline binary and
prints a one-shot preview rendered through your existing config. Run it
after upgrading the package (npm i -g @odere-pro/agentline) to start using
the new version. If agentline is not yet set up on this host, start
performs the first-time wiring too.

Options:
  --from-source   npm link from the local checkout instead of the registry.
  --force         Overwrite a non-agentline statusLine value.
  --dry-run       Print every action that would be taken; touch nothing.
  --no-preview    Skip the statusline preview after wiring.
  -h, --help      Show this message.

Your config.json is PRESERVED. To reset it to the shipped default
template instead, use \`agentline reset\`.
`,
  "cmd.start.preview-label": "Statusline preview (your config):",
  "cmd.start.preview-unavailable":
    "Statusline preview unavailable — run `agentline doctor` to check your config.",
  "cmd.start.ultracode-notice":
    "What's new: an `xhigh` reasoning effort now shows as `ultracode` by default.\n" +
    "To keep the raw `xhigh` label, pick the `literal` variant on your thinking-effort widget (`agentline edit`), or set `assumeUltracode: false` in your config.",
} as const;

export type DictionaryId = keyof typeof EN_DICTIONARY;
