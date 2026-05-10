#!/usr/bin/env bash
# scripts/install.sh — install agentline and wire it into Claude Code.
#
# Idempotent. Verifies Node >=20. In order:
#   1. install or link `@agentline/cli` (npm i -g, or `npm link` with --from-source)
#   2. seed the user config from templates/default.config.json (no overwrite)
#   3. seed themes/ to the same config dir
#   4. copy .claude/agents/agentline*.md skill files to $HOME/.claude/agents/
#   5. wire `statusLine` into $HOME/.claude/settings.json (always global)
#   6. write install manifest to state dir
# All filesystem writes go through atomic write-temp + rename.
#
# Spec: §10. Bash 3.2 friendly; no associative arrays / mapfile / Bash-4 features.

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${THIS_DIR}/.." && pwd)"
# shellcheck source=lib/common.sh
. "${THIS_DIR}/lib/common.sh"
al_setup

DRY_RUN=0
FORCE=0
FROM_SOURCE=0

usage() {
  cat <<'EOF'
agentline install — wires @agentline/cli into Claude Code's statusline.

Usage:
  scripts/install.sh [--dry-run] [--force] [--from-source]

Options:
  --dry-run       Print the actions that would be taken; touch nothing.
  --force         Overwrite an existing statusLine value if it does not
                  already point at agentline.
  --from-source   `npm link` from the current checkout instead of installing
                  the published tarball. Intended for repo contributors.
  -h, --help      Show this help.

Wires statusLine into $HOME/.claude/settings.json. Honours $CLAUDE_CONFIG_DIR.

Exits 0 on success, 1 on unrecoverable error.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    --from-source) FROM_SOURCE=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      al_log_error "unknown option: $1"
      usage >&2
      exit 1
      ;;
  esac
  shift
done

al_require_node

os="$(al_detect_os)"
config_dir="$(al_config_dir)"
config_file="$(al_config_file)"
themes_dir="$(al_themes_dir)"
settings_file="$(al_claude_settings)"
settings_backup="${AL_STATUS_LINE_BACKUP}"
manifest_file="${AL_STATE_DIR}/manifest.json"

al_log_info "platform: ${os}"
al_log_info "config dir: ${config_dir}"
al_log_info "settings target: ${settings_file}"

if [ "${DRY_RUN}" = "1" ]; then
  al_log_info "dry-run: no filesystem changes will be applied"
fi

# ---------------- helpers ----------------

al_node() {
  node "$@"
}

# Byte-faithful atomic copy via node, honouring dry-run.
atomic_copy_via_node() {
  __src="$1"
  __target="$2"
  if [ "${DRY_RUN}" = "1" ]; then
    al_log_info "would write: ${__target}"
    return 0
  fi
  AL_SRC="${__src}" AL_TARGET="${__target}" al_node - <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const src = process.env.AL_SRC;
const target = process.env.AL_TARGET;
const data = fs.readFileSync(src);
fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
const tmp = path.join(path.dirname(target), '.' + path.basename(target) + '.' + crypto.randomBytes(6).toString('hex') + '.tmp');
const fd = fs.openSync(tmp, 'w', 0o600);
try {
  fs.writeFileSync(fd, data);
  fs.fsyncSync(fd);
} finally {
  fs.closeSync(fd);
}
fs.renameSync(tmp, target);
JS
}

# Atomic write of an in-memory string.
atomic_write_via_node() {
  __target="$1"
  __content="$2"
  if [ "${DRY_RUN}" = "1" ]; then
    al_log_info "would write: ${__target}"
    return 0
  fi
  AL_TARGET="${__target}" AL_CONTENT="${__content}" al_node - <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const target = process.env.AL_TARGET;
const content = process.env.AL_CONTENT;
fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
const tmp = path.join(path.dirname(target), '.' + path.basename(target) + '.' + crypto.randomBytes(6).toString('hex') + '.tmp');
const fd = fs.openSync(tmp, 'w', 0o600);
try {
  fs.writeFileSync(fd, content);
  fs.fsyncSync(fd);
} finally {
  fs.closeSync(fd);
}
fs.renameSync(tmp, target);
JS
}

# Step 1: install or link @agentline/cli.
install_or_link_package() {
  if [ "${FROM_SOURCE}" = "1" ]; then
    al_log_info "installing from source via \`npm link\` in ${REPO_ROOT}"
    if [ "${DRY_RUN}" = "1" ]; then
      al_log_info "would run: (cd ${REPO_ROOT} && npm install --no-audit --no-fund && npm run build && npm link)"
      return 0
    fi
    (
      cd "${REPO_ROOT}"
      npm install --no-audit --no-fund
      npm run build
      npm link
    )
    # Verify the link actually landed.
    __bin="$(command -v agentline 2>/dev/null || true)"
    if [ -z "${__bin}" ] || [ ! -x "${__bin}" ]; then
      al_die "agentline binary not found after npm link; check npm global bin is on PATH"
    fi
    al_log_info "linked: ${__bin}"
    return 0
  fi
  # PATH check: only skip if the binary actually exists at the resolved path.
  __bin="$(command -v agentline 2>/dev/null || true)"
  if [ -n "${__bin}" ] && [ -x "${__bin}" ]; then
    al_log_info "@agentline/cli already installed at ${__bin}; skipping global install"
    return 0
  fi
  al_log_info "installing @agentline/cli globally via npm"
  if [ "${DRY_RUN}" = "1" ]; then
    al_log_info "would run: npm install -g @agentline/cli"
    return 0
  fi
  npm install -g @agentline/cli
  __bin="$(command -v agentline 2>/dev/null || true)"
  if [ -z "${__bin}" ] || [ ! -x "${__bin}" ]; then
    al_die "agentline binary not found after npm install -g; check npm global bin is on PATH"
  fi
  al_log_info "installed: ${__bin}"
}

# Step 2: seed user config from templates/default.config.json.
seed_user_config() {
  __template="${REPO_ROOT}/templates/default.config.json"
  if [ ! -f "${__template}" ]; then
    al_log_warn "templates/default.config.json missing; skipping config seed"
    return 0
  fi
  if [ -f "${config_file}" ]; then
    al_log_info "user config already exists; preserving"
    return 0
  fi
  atomic_copy_via_node "${__template}" "${config_file}"
  [ "${DRY_RUN}" = "1" ] || al_log_info "seeded ${config_file}"
}

# Step 3: copy themes/*.json into config dir's themes subfolder.
seed_themes() {
  __src_dir="${REPO_ROOT}/themes"
  if [ ! -d "${__src_dir}" ]; then
    al_log_warn "themes/ not present in repo; skipping theme seed"
    return 0
  fi
  __copied=0
  for __theme in "${__src_dir}"/*.json; do
    [ -e "${__theme}" ] || continue
    __name="$(basename "${__theme}")"
    __dest="${themes_dir}/${__name}"
    if [ -f "${__dest}" ]; then
      continue
    fi
    atomic_copy_via_node "${__theme}" "${__dest}"
    __copied=$((__copied + 1))
  done
  if [ "${__copied}" -gt 0 ]; then
    [ "${DRY_RUN}" = "1" ] || al_log_info "seeded ${__copied} theme(s) into ${themes_dir}"
  else
    al_log_info "all themes already present in ${themes_dir}"
  fi
}

# Step 4: copy agents/agentline*.md skill files to $HOME/.claude/agents/.
seed_skills() {
  __src_dir="${REPO_ROOT}/agents"
  if [ ! -d "${__src_dir}" ]; then
    al_log_warn "agents/ not present in repo; skipping skill seed"
    return 0
  fi
  __agents_dir="${AL_AGENTS_DIR}"
  __copied=0
  for __skill in "${__src_dir}"/agentline*.md; do
    [ -e "${__skill}" ] || continue
    __name="$(basename "${__skill}")"
    __dest="${__agents_dir}/${__name}"
    if [ -f "${__dest}" ]; then
      al_log_info "skill already present: ${__dest}"
      continue
    fi
    atomic_copy_via_node "${__skill}" "${__dest}"
    __copied=$((__copied + 1))
  done
  if [ "${__copied}" -gt 0 ]; then
    [ "${DRY_RUN}" = "1" ] || al_log_info "installed ${__copied} skill(s) into ${__agents_dir}"
  else
    al_log_info "agentline skills already present in ${__agents_dir}"
  fi
}

# Step 5: wire statusLine into Claude Code settings.
wire_statusline() {
  __target_file="$1"
  __backup_file="$2"

  __cmd="$(resolve_status_command)"
  al_log_info "wiring statusLine into ${__target_file}"

  __existing_block=""
  if [ -f "${__target_file}" ]; then
    __existing_block="$(read_existing_statusline "${__target_file}")"
  fi

  case "${__existing_block}" in
    "")            __action="set"      ;;
    "agentline")   __action="noop"     ;;
    *)             __action="conflict" ;;
  esac

  if [ "${__action}" = "noop" ]; then
    al_log_info "statusLine already wired to agentline in ${__target_file}; nothing to do"
    return 0
  fi

  if [ "${DRY_RUN}" = "1" ]; then
    al_log_info "would back up prior statusLine to ${__backup_file}"
  else
    save_statusline_backup "${__target_file}" "${__backup_file}"
  fi

  if [ "${__action}" = "conflict" ] && [ "${FORCE}" != "1" ]; then
    al_log_info "backing up foreign statusLine before overwrite (uninstall will restore)"
  elif [ "${__action}" = "conflict" ]; then
    al_log_info "force: overwriting existing statusLine in ${__target_file}"
  fi

  __new_settings_json="$(merge_statusline_into_settings "${__target_file}" "${__cmd}")"
  atomic_write_via_node "${__target_file}" "${__new_settings_json}"
  [ "${DRY_RUN}" = "1" ] || al_log_info "wired statusLine into ${__target_file}"
}

# Resolve which command to wire. Verifies the binary exists as an executable
# file at the resolved path; falls back to npx if not.
resolve_status_command() {
  __bin="$(command -v agentline 2>/dev/null || true)"
  if [ -n "${__bin}" ] && [ -x "${__bin}" ]; then
    printf '%s' "${__bin}"
    return 0
  fi
  printf 'npx -y @agentline/cli'
}

# Save a snapshot of the existing `statusLine` value to the backup file.
# Idempotent — first install wins; re-runs never clobber the original.
save_statusline_backup() {
  __settings="$1"
  __backup="$2"
  if [ -f "${__backup}" ]; then
    return 0
  fi
  AL_VERSION_FOR_BACKUP="${AL_VERSION_FOR_BACKUP:-0.1.0}"
  AL_SETTINGS_FILE="${__settings}" \
  AL_BACKUP_FILE="${__backup}" \
  AL_VERSION_FOR_BACKUP="${AL_VERSION_FOR_BACKUP}" \
  al_node - <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const settings = process.env.AL_SETTINGS_FILE;
const backup = process.env.AL_BACKUP_FILE;
let parsed = {};
try {
  const raw = fs.readFileSync(settings, 'utf8');
  const t = JSON.parse(raw);
  if (t && typeof t === 'object' && !Array.isArray(t)) parsed = t;
} catch { /* fresh */ }
const present = Object.prototype.hasOwnProperty.call(parsed, 'statusLine');
const body = {
  version: 1,
  createdAt: new Date().toISOString(),
  agentlineVersion: process.env.AL_VERSION_FOR_BACKUP || '0.1.0',
  previousStatusLinePresent: present,
  previousStatusLine: present ? parsed.statusLine : null,
};
fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
const tmp = backup + '.tmp.' + process.pid;
const fd = fs.openSync(tmp, 'w', 0o600);
try {
  fs.writeFileSync(fd, JSON.stringify(body, null, 2) + '\n');
  fs.fsyncSync(fd);
} finally {
  fs.closeSync(fd);
}
fs.renameSync(tmp, backup);
JS
}

read_existing_statusline() {
  __file="$1"
  AL_FILE="${__file}" al_node - <<'JS'
const fs = require('node:fs');
const file = process.env.AL_FILE;
let raw;
try { raw = fs.readFileSync(file, 'utf8'); } catch { console.log(''); process.exit(0); }
let parsed;
try { parsed = JSON.parse(raw); } catch { console.log(''); process.exit(0); }
const sl = parsed && parsed.statusLine;
if (sl == null || sl === '') { console.log(''); process.exit(0); }
const cmd = (typeof sl === 'string') ? sl : (sl && typeof sl.command === 'string' ? sl.command : '');
if (!cmd) { console.log(''); process.exit(0); }
if (/agentline/.test(cmd)) { console.log('agentline'); process.exit(0); }
console.log('foreign:' + cmd);
JS
}

merge_statusline_into_settings() {
  __file="$1"
  __cmd="$2"
  AL_FILE="${__file}" AL_CMD="${__cmd}" al_node - <<'JS'
const fs = require('node:fs');
const file = process.env.AL_FILE;
const cmd = process.env.AL_CMD;
let parsed = {};
try {
  const raw = fs.readFileSync(file, 'utf8');
  const t = JSON.parse(raw);
  if (t && typeof t === 'object' && !Array.isArray(t)) parsed = t;
} catch { /* fresh object */ }
parsed.statusLine = { type: 'command', command: cmd, padding: 0 };
process.stdout.write(JSON.stringify(parsed, null, 2) + '\n');
JS
}

# Step 6: write install manifest listing all managed paths.
write_manifest() {
  if [ "${DRY_RUN}" = "1" ]; then
    al_log_info "would write manifest: ${manifest_file}"
    return 0
  fi
  AL_MANIFEST_FILE="${manifest_file}" \
  AL_SETTINGS_FILE="${settings_file}" \
  AL_CONFIG_FILE="${config_file}" \
  AL_THEMES_DIR="${themes_dir}" \
  AL_AGENTS_DIR="${AL_AGENTS_DIR}" \
  AL_REPO_ROOT="${REPO_ROOT}" \
  al_node - <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const manifestFile = process.env.AL_MANIFEST_FILE;
const settingsFile = process.env.AL_SETTINGS_FILE;
const configFile   = process.env.AL_CONFIG_FILE;
const themesDir    = process.env.AL_THEMES_DIR;
const agentsDir    = process.env.AL_AGENTS_DIR;
const repoRoot     = process.env.AL_REPO_ROOT;

// Collect theme files present in the install target.
const themes = [];
try {
  for (const f of fs.readdirSync(themesDir)) {
    if (f.endsWith('.json')) themes.push(path.join(themesDir, f));
  }
} catch { /* dir absent */ }

// Collect skill files present in the install target.
const skills = [];
try {
  for (const f of fs.readdirSync(agentsDir)) {
    if (f.startsWith('agentline') && f.endsWith('.md'))
      skills.push(path.join(agentsDir, f));
  }
} catch { /* dir absent */ }

const manifest = {
  version: 1,
  installedAt: new Date().toISOString(),
  statusLineSettings: settingsFile,
  userConfig: configFile,
  themes,
  skills,
};

fs.mkdirSync(path.dirname(manifestFile), { recursive: true, mode: 0o700 });
const tmp = manifestFile + '.tmp.' + process.pid;
const fd = fs.openSync(tmp, 'w', 0o600);
try {
  fs.writeFileSync(fd, JSON.stringify(manifest, null, 2) + '\n');
  fs.fsyncSync(fd);
} finally {
  fs.closeSync(fd);
}
fs.renameSync(tmp, manifestFile);
JS
  al_log_info "wrote manifest: ${manifest_file}"
}

# ---------------- run ----------------

install_or_link_package
seed_user_config
seed_themes
seed_skills
wire_statusline "${settings_file}" "${settings_backup}"
write_manifest

al_log_info "install complete"
