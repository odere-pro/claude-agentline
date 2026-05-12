/**
 * `agentline doctor [--fix] [--json] [--strict]` argv parser + entry point.
 *
 * Repair mode (`--fix`) only touches D01–D04. JSON mode (`--json`)
 * suppresses the human formatter entirely so it pipes cleanly into
 * `jq` and CI pipelines. `--strict` flips the exit-code semantics so
 * unresolved warnings/failures become non-zero (used by CI gates).
 */

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { runDoctor, renderReport } from "./run.js";

const HELP = `agentline doctor — diagnose and (optionally) repair host wiring

Usage:
  agentline doctor [--fix] [--json] [--strict]

Options:
  --fix       repair D01-D04 (statusLine wiring, config seed, themes copy)
  --json      machine-readable report (for CI / scripting)
  --strict    promote warnings/failures to non-zero exit (used by gates)
  -h, --help  show this message
`;

export interface DoctorArgs {
  fix: boolean;
  json: boolean;
  strict: boolean;
}

export function parseDoctorArgs(rest: string[]): DoctorArgs {
  const args: DoctorArgs = { fix: false, json: false, strict: false };
  for (const arg of rest) {
    if (arg === "--fix") args.fix = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--strict") args.strict = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else throw new Error(`agentline doctor: unknown argument '${arg}'`);
  }
  return args;
}

export async function runDoctorCommand(args: DoctorArgs): Promise<number> {
  const { report, exitCode } = await runDoctor({ ...args });
  process.stdout.write(renderReport(report, args.json));
  return exitCode;
}
