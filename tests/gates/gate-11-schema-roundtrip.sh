#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 11: schema-roundtrip — the shipped JSON Schema validates the default
# config template without manual fix-up.
# Spec: §4.7, §11.2 G11
# Pass: ajv validates `templates/default.config.json` against
#       `schemas/config.schema.json` without errors.
# Fail: schema fails to compile, or the template fails validation.
# Skip: `dist/cli.mjs` is absent (CI builds first; local trees may not have).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

bin="$(repo_path dist/cli.mjs)"
default_tmpl="$(repo_path templates/default.config.json)"
schema_src="$(repo_path schemas/config.schema.json)"

if [ ! -f "${bin}" ]; then
  skip_gate "dist/cli.mjs not built; run \`npm run build\` to activate"
fi
if [ ! -f "${default_tmpl}" ]; then
  skip_gate "templates/default.config.json not present yet"
fi
if [ ! -f "${schema_src}" ]; then
  skip_gate "schemas/config.schema.json not present yet"
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
report_file="${work_dir}/report.txt"

# Validate the default template against the shipped schema. The Node script
# keeps all heavy lifting inside ajv; failures are written to ${report_file}
# as one record per template so the gate's diagnostic surface is stable.
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
  "${schema_src}" "${report_file}" "${default_tmpl}" \
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
  fail_gate "schema rejected the shipped default template"
fi

pass_gate "schema validates default template"
