#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 11: schema-roundtrip — the embedded JSON Schema validates the shipped
# config templates without manual fix-up.
# Spec: §4.7, §11.2 G11
# Pass: `node dist/cli.mjs schema` prints a JSON Schema, and ajv validates
#       both `templates/default.config.json` and `templates/minimal.config.json`
#       against it without errors.
# Fail: schema printing crashes, or any template fails validation.
# Skip: `dist/cli.mjs` is absent (CI builds first; local trees may not have).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

bin="$(repo_path dist/cli.mjs)"
default_tmpl="$(repo_path templates/default.config.json)"
minimal_tmpl="$(repo_path templates/minimal.config.json)"

if [ ! -f "${bin}" ]; then
  skip_gate "dist/cli.mjs not built; run \`npm run build\` to activate"
fi
if [ ! -f "${default_tmpl}" ] || [ ! -f "${minimal_tmpl}" ]; then
  skip_gate "templates/{default,minimal}.config.json not present yet"
fi
if ! have_cmd node; then
  skip_gate "node not available on PATH"
fi

ajv_pkg="$(repo_path node_modules/ajv/package.json)"
formats_pkg="$(repo_path node_modules/ajv-formats/package.json)"
if [ ! -f "${ajv_pkg}" ] || [ ! -f "${formats_pkg}" ]; then
  skip_gate "ajv not installed; run \`npm ci\` to activate"
fi

work_dir="${GATES_TMP_DIR}/gate-11"
rm -rf "${work_dir}"
mkdir -p "${work_dir}"
schema_file="${work_dir}/config.schema.json"
report_file="${work_dir}/report.txt"

# Capture the embedded schema. A non-zero exit, an empty stdout, or
# unparseable JSON all count as a failure to expose the schema.
if ! node "${bin}" config schema >"${schema_file}" 2>"${work_dir}/schema.stderr"; then
  log_info "\`node dist/cli.mjs config schema\` exited non-zero:"
  sed 's/^/    /' "${work_dir}/schema.stderr" >&2
  fail_gate "config schema subcommand crashed"
fi
if [ ! -s "${schema_file}" ]; then
  fail_gate "schema subcommand produced empty output"
fi

# Validate each template against the captured schema. The Node script keeps
# all heavy lifting inside ajv; failures are written to ${report_file} as
# one record per template so the gate's diagnostic surface is stable.
set +e
node \
  --input-type=module \
  -e '
    import("node:fs/promises").then(async (fs) => {
      const { default: Ajv } = await import("ajv");
      const { default: addFormats } = await import("ajv-formats");
      const [, schemaPath, reportPath, ...templates] = process.argv;
      const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
      const ajv = new Ajv({ allErrors: true, strict: false });
      addFormats(ajv);
      let validate;
      try {
        validate = ajv.compile(schema);
      } catch (err) {
        await fs.writeFile(reportPath, "schema compile error: " + err.message + "\n");
        process.exit(1);
      }
      const lines = [];
      let failed = 0;
      for (const tpl of templates) {
        const data = JSON.parse(await fs.readFile(tpl, "utf8"));
        const ok = validate(data);
        if (ok) {
          lines.push(tpl + ": OK");
          continue;
        }
        failed += 1;
        lines.push(tpl + ": FAIL");
        for (const err of validate.errors || []) {
          lines.push("  " + (err.instancePath || "/") + " " + err.message);
        }
      }
      await fs.writeFile(reportPath, lines.join("\n") + "\n");
      process.exit(failed === 0 ? 0 : 1);
    }).catch((err) => {
      console.error(err && err.stack ? err.stack : String(err));
      process.exit(2);
    });
  ' \
  "${schema_file}" "${report_file}" "${default_tmpl}" "${minimal_tmpl}" \
  >"${work_dir}/validate.stdout" 2>"${work_dir}/validate.stderr"
rc=$?
set -e

if [ "${rc}" -ne 0 ]; then
  if [ -s "${report_file}" ]; then
    log_info "schema-roundtrip report:"
    sed 's/^/    /' "${report_file}" >&2
  fi
  if [ -s "${work_dir}/validate.stderr" ]; then
    log_info "validator stderr:"
    sed 's/^/    /' "${work_dir}/validate.stderr" >&2
  fi
  fail_gate "schema rejected one or more shipped templates"
fi

pass_gate "schema validates default + minimal templates"
