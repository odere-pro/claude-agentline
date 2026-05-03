/**
 * `agentline doctor [--fix] [--json] [--strict]` argv parser + entry point.
 *
 * Repair mode (`--fix`) only touches D01–D04. JSON mode (`--json`)
 * suppresses the human formatter entirely so it pipes cleanly into
 * `jq` and CI pipelines. `--strict` flips the exit-code semantics so
 * unresolved warnings/failures become non-zero (used by CI gates).
 */

import { runDoctor, renderReport } from "./run.js";

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
    else if (arg === "--help" || arg === "-h") {
      // Caller handles --help via runHelp; here we just no-op so a stray flag doesn't crash.
    } else {
      throw new Error(`agentline doctor: unknown argument '${arg}'`);
    }
  }
  return args;
}

export async function runDoctorCommand(args: DoctorArgs): Promise<number> {
  const { report, exitCode } = await runDoctor({ ...args });
  process.stdout.write(renderReport(report, args.json));
  return exitCode;
}
