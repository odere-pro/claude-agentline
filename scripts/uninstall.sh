#!/usr/bin/env bash
# scripts/uninstall.sh — remove agentline from this host.
#
# Idempotent. In order:
#   1. `npm uninstall -g @agentline/cli` (skipped if absent).
#   2. remove themes whose bytes match the bundled set; preserve user-edited.
#   3. on --purge, also remove user-edited config / themes.
#   4. remove the `statusLine` entry from Claude Code settings only when
#      it still points at agentline.
# Refuses to delete unrelated files. No `rm -rf "$VAR"` without guards
# (al_safe_rm enforces).
#
# Spec: §10. Bash 3.2 friendly.

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${THIS_DIR}/.." && pwd)"
# shellcheck source=lib/common.sh
. "${THIS_DIR}/lib/common.sh"
al_setup

DRY_RUN=0
PURGE=0

usage() {
  cat <<'EOF'
agentline uninstall — remove agentline from this host.

Usage:
  scripts/uninstall.sh [--dry-run] [--purge]

Options:
  --dry-run     Print the actions that would be taken; touch nothing.
  --purge       Also remove user-edited config files.
  -h, --help    Show this help.

Idempotent. Preserves user-authored content unless --purge is passed.
Honours $CLAUDE_CONFIG_DIR.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --purge) PURGE=1 ;;
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

config_dir="$(al_config_dir)"
config_file="$(al_config_file)"
themes_dir="$(al_themes_dir)"
manifest_file="${AL_STATE_DIR}/manifest.json"

# Prefer the settings file recorded in the manifest; fall back to the
# default global path so uninstall works even if the manifest is absent.
settings_file="$(al_claude_settings)"
if [ -f "${manifest_file}" ]; then
  __manifest_settings="$(AL_MANIFEST_FILE="${manifest_file}" node - 2>/dev/null <<'JS' || true
try {
  const m = JSON.parse(require('fs').readFileSync(process.env.AL_MANIFEST_FILE, 'utf8'));
  if (m.statusLineSettings) process.stdout.write(m.statusLineSettings);
} catch {}
JS
)"
  if [ -n "${__manifest_settings}" ]; then
    settings_file="${__manifest_settings}"
  fi
fi

al_log_info "platform: $(al_detect_os)"
al_log_info "config dir: ${config_dir}"
al_log_info "claude settings target: ${settings_file}"

if [ "${DRY_RUN}" = "1" ]; then
  al_log_info "dry-run: no filesystem changes will be applied"
fi

# ---------------- helpers ----------------

atomic_write_via_node() {
  __target="$1"
  __content="$2"
  if [ "${DRY_RUN}" = "1" ]; then
    al_log_info "would write: ${__target}"
    return 0
  fi
  AL_TARGET="${__target}" AL_CONTENT="${__content}" node - <<'JS'
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

strip_statusline_from_settings() {
  __file="$1"
  AL_FILE="${__file}" node - <<'JS'
const fs = require('node:fs');
const file = process.env.AL_FILE;
let parsed = {};
try {
  const raw = fs.readFileSync(file, 'utf8');
  const t = JSON.parse(raw);
  if (t && typeof t === 'object' && !Array.isArray(t)) parsed = t;
} catch { /* nothing to strip */ }
delete parsed.statusLine;
process.stdout.write(JSON.stringify(parsed, null, 2) + '\n');
JS
}

read_existing_statusline() {
  __file="$1"
  AL_FILE="${__file}" node - <<'JS'
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

sha_of() {
  __f="$1"
  if [ ! -f "${__f}" ]; then
    printf ''
    return 0
  fi
  AL_FILE="${__f}" node - <<'JS'
const fs = require('node:fs');
const crypto = require('node:crypto');
const buf = fs.readFileSync(process.env.AL_FILE);
process.stdout.write(crypto.createHash('sha256').update(buf).digest('hex'));
JS
}

# ---------------- steps ----------------

uninstall_global_package() {
  if ! command -v npm >/dev/null 2>&1; then
    al_log_info "npm not on PATH; skipping global uninstall"
    return 0
  fi
  if ! npm ls -g --depth=0 2>/dev/null | grep -q '@agentline/cli'; then
    al_log_info "@agentline/cli not globally installed; nothing to uninstall"
    return 0
  fi
  if [ "${DRY_RUN}" = "1" ]; then
    al_log_info "would run: npm uninstall -g @agentline/cli"
    return 0
  fi
  npm uninstall -g @agentline/cli || al_log_warn "npm uninstall reported non-zero exit; continuing"
}

tidy_themes() {
  __src_dir="${REPO_ROOT}/themes"
  if [ ! -d "${themes_dir}" ]; then
    al_log_info "themes dir not present; nothing to tidy"
    return 0
  fi
  __removed=0
  __preserved=0
  for __dest in "${themes_dir}"/*.json; do
    [ -e "${__dest}" ] || continue
    __name="$(basename "${__dest}")"
    __src="${__src_dir}/${__name}"
    __same=0
    if [ -f "${__src}" ]; then
      [ "$(sha_of "${__dest}")" = "$(sha_of "${__src}")" ] && __same=1
    fi
    if [ "${__same}" = "1" ] || [ "${PURGE}" = "1" ]; then
      if [ "${DRY_RUN}" = "1" ]; then
        al_log_info "would remove theme: ${__dest}"
      else
        rm -f -- "${__dest}"
      fi
      __removed=$((__removed + 1))
    else
      __preserved=$((__preserved + 1))
    fi
  done
  al_log_info "themes: ${__removed} removed, ${__preserved} preserved"
  if [ "${DRY_RUN}" != "1" ] && [ -d "${themes_dir}" ] && [ -z "$(ls -A "${themes_dir}" 2>/dev/null || true)" ]; then
    rmdir "${themes_dir}" 2>/dev/null || true
  fi
}

tidy_user_config() {
  if [ ! -f "${config_file}" ]; then
    al_log_info "no user config to remove"
    return 0
  fi
  __template="${REPO_ROOT}/templates/default.config.json"
  __same=0
  if [ -f "${__template}" ] && [ "$(sha_of "${config_file}")" = "$(sha_of "${__template}")" ]; then
    __same=1
  fi
  if [ "${__same}" = "1" ] || [ "${PURGE}" = "1" ]; then
    if [ "${DRY_RUN}" = "1" ]; then
      al_log_info "would remove user config: ${config_file}"
      return 0
    fi
    rm -f -- "${config_file}"
    al_log_info "removed ${config_file}"
    if [ -d "${config_dir}" ] && [ -z "$(ls -A "${config_dir}" 2>/dev/null || true)" ]; then
      rmdir "${config_dir}" 2>/dev/null || true
    fi
  else
    al_log_info "user config differs from shipped default; preserving (use --purge to remove)"
  fi
}

tidy_skills() {
  __src_dir="${REPO_ROOT}/agents"
  __agents_dir="${AL_AGENTS_DIR}"
  if [ ! -d "${__agents_dir}" ]; then
    al_log_info "no agents dir; nothing to tidy"
    return 0
  fi
  __removed=0
  __preserved=0
  for __dest in "${__agents_dir}"/agentline*.md; do
    [ -e "${__dest}" ] || continue
    __name="$(basename "${__dest}")"
    __src="${__src_dir}/${__name}"
    __same=0
    if [ -f "${__src}" ]; then
      [ "$(sha_of "${__dest}")" = "$(sha_of "${__src}")" ] && __same=1
    fi
    if [ "${__same}" = "1" ] || [ "${PURGE}" = "1" ]; then
      if [ "${DRY_RUN}" = "1" ]; then
        al_log_info "would remove skill: ${__dest}"
      else
        rm -f -- "${__dest}"
      fi
      __removed=$((__removed + 1))
    else
      __preserved=$((__preserved + 1))
    fi
  done
  al_log_info "skills: ${__removed} removed, ${__preserved} preserved"
}

unwire_statusline() {
  if [ ! -f "${settings_file}" ]; then
    al_log_info "no settings file; nothing to unwire"
    return 0
  fi

  # If we recorded a backup at install time, restore the prior state from
  # it. The backup is the source of truth for "what was there before
  # agentline" — when present, even a foreign statusLine that we *did*
  # overwrite is restored cleanly. When the backup is absent, fall back
  # to the legacy "remove only if it points at agentline" behaviour.
  if [ -f "${AL_STATUS_LINE_BACKUP}" ]; then
    if [ "${DRY_RUN}" = "1" ]; then
      al_log_info "would restore statusLine from backup ${AL_STATUS_LINE_BACKUP}"
      return 0
    fi
    __new="$(restore_statusline_from_backup "${settings_file}" "${AL_STATUS_LINE_BACKUP}")"
    atomic_write_via_node "${settings_file}" "${__new}"
    rm -f -- "${AL_STATUS_LINE_BACKUP}"
    if [ -d "${AL_STATE_DIR}" ] && [ -z "$(ls -A "${AL_STATE_DIR}" 2>/dev/null || true)" ]; then
      rmdir "${AL_STATE_DIR}" 2>/dev/null || true
    fi
    al_log_info "restored statusLine from backup; removed ${AL_STATUS_LINE_BACKUP}"
    return 0
  fi

  __existing="$(read_existing_statusline "${settings_file}")"
  case "${__existing}" in
    "")
      al_log_info "no statusLine entry; nothing to unwire"
      return 0
      ;;
    "agentline")
      al_log_info "removing agentline statusLine entry (no backup found)"
      __new="$(strip_statusline_from_settings "${settings_file}")"
      atomic_write_via_node "${settings_file}" "${__new}"
      ;;
    *)
      al_log_warn "settings.json statusLine references another tool (${__existing#foreign:}); leaving untouched"
      ;;
  esac
}

# Read settings.json + the backup, write back the prior statusLine
# (or delete the key when previousStatusLinePresent: false). Emits the
# new settings.json contents on stdout so atomic_write_via_node can
# rewrite the file in one fsync.
restore_statusline_from_backup() {
  __settings="$1"
  __backup="$2"
  AL_SETTINGS_FILE="${__settings}" \
  AL_BACKUP_FILE="${__backup}" \
  node - <<'JS'
const fs = require('node:fs');
const settings = process.env.AL_SETTINGS_FILE;
const backup = process.env.AL_BACKUP_FILE;
let parsed = {};
try {
  const raw = fs.readFileSync(settings, 'utf8');
  const t = JSON.parse(raw);
  if (t && typeof t === 'object' && !Array.isArray(t)) parsed = t;
} catch { /* fresh */ }
const b = JSON.parse(fs.readFileSync(backup, 'utf8'));
if (b.version !== 1) {
  process.stderr.write('agentline: backup has unsupported version ' + b.version + '\n');
  process.exit(1);
}
if (b.previousStatusLinePresent) {
  parsed.statusLine = b.previousStatusLine;
} else {
  delete parsed.statusLine;
}
process.stdout.write(JSON.stringify(parsed, null, 2) + '\n');
JS
}

# ---------------- run ----------------

uninstall_global_package
tidy_themes
tidy_user_config
tidy_skills
unwire_statusline

# Remove the Nerd Font probe sentinel — purely a runtime artefact, no
# user data, so it always goes regardless of --purge.
__nerd_sentinel="${AL_STATE_DIR}/nerd-font.json"
if [ -f "${__nerd_sentinel}" ]; then
  if [ "${DRY_RUN}" = "1" ]; then
    al_log_info "would remove Nerd Font sentinel: ${__nerd_sentinel}"
  else
    rm -f -- "${__nerd_sentinel}"
  fi
fi

# Remove the install manifest last so all other steps can still read it.
if [ -f "${manifest_file}" ]; then
  if [ "${DRY_RUN}" = "1" ]; then
    al_log_info "would remove manifest: ${manifest_file}"
  else
    rm -f -- "${manifest_file}"
    al_log_info "removed manifest: ${manifest_file}"
    if [ -d "${AL_STATE_DIR}" ] && [ -z "$(ls -A "${AL_STATE_DIR}" 2>/dev/null || true)" ]; then
      rmdir "${AL_STATE_DIR}" 2>/dev/null || true
    fi
  fi
fi

al_log_info "uninstall complete"
