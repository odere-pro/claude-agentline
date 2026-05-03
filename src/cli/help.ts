/**
 * Shared per-subcommand help machinery.
 *
 * Each subcommand's `parse*Args` calls `requestHelp(text)` when it
 * sees `-h` or `--help`. The dispatcher in `src/cli.ts` catches the
 * resulting `HelpRequestedError`, writes the captured body, and exits 0.
 *
 * Centralising the throw lets every subcommand opt in with one line
 * (`if (HELP_FLAGS.has(arg)) requestHelp(MY_HELP);`) without the
 * dispatcher having to know about each command's flag schema.
 */

export const HELP_FLAGS: ReadonlySet<string> = new Set(["-h", "--help"]);

export class HelpRequestedError extends Error {
  readonly body: string;
  constructor(body: string) {
    super("help requested");
    this.name = "HelpRequestedError";
    this.body = body;
  }
}

export function requestHelp(body: string): never {
  throw new HelpRequestedError(body);
}

export function isHelpFlag(arg: string | undefined): boolean {
  return arg !== undefined && HELP_FLAGS.has(arg);
}
