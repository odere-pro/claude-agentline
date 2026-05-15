# 17 · Security and compliance

> **Intent:** Catalogue the security invariants, the threat model they defend against, and the controls that enforce them.
> **Reads-with:** `03-non-functional-requirements`, `05-design-patterns`, `06-data-contracts`.

The render path is a small attack surface, but it is invoked on every host prompt, so a vulnerability there has fast, repeated blast radius. The controls below assume an attacker who can craft a malicious stdin payload (because they control a repo the host opens, or because they intercept the host process's stdin). They do **not** assume an attacker with arbitrary code execution on the user's host — that is outside the threat model.

---

## I-01 · Render path makes no network calls

- **Invariant.** Zero outbound network I/O during the render hot path.
- **Threat.** A renderer that phones home leaks the user's identity and activity. A renderer that fetches templates risks tampering and supply-chain compromise.
- **Control.** gate-14 (sandbox denies network egress; render must still succeed). All update / version-check logic lives behind a separate verb that the render path never invokes.

## I-02 · Render path does not mutate host state

- **Invariant.** Zero writes to filesystem, environment, or host settings on the render path.
- **Threat.** A renderer that writes can be coerced into writing somewhere the user did not expect.
- **Control.** Code review; the state writes that **do** happen (stdin cache, render cache) are off the render path (they execute after the stdout write or in a separate verb).

## I-03 · Transcript and auth reads are sandboxed under the host config root

- **Invariant.** Any file path coming from user-supplied data (stdin payload, config) MUST resolve under the allowlisted root.
- **Threat.** A malicious stdin payload sets `transcript_path: "/etc/shadow"`; token counters in the rendered line become an oracle for which files exist and are readable.
- **Control.** Path canonicalisation before open; refuse if the canonical path is not under the root. Tests override the root via env var (`<PRODUCT>_TRANSCRIPT_ROOT`).

## I-04 · File-size caps

- **Invariant.** Every file the renderer reads has a hard size cap: transcript 16 MB, auth file 64 KB, stdin 256 KB.
- **Threat.** A symlink to `/dev/zero` blows the memory budget and the cold-start budget.
- **Control.** Caps enforced at the read boundary; oversize files render dependent widgets as hidden, not error.

## I-05 · Reserved meta-keys stripped at every JSON parse boundary

- **Invariant.** `__proto__`, `constructor`, `prototype` keys are dropped recursively after every `JSON.parse` (or equivalent).
- **Threat.** Prototype pollution in JS runtimes; analogous attacks via reflection in other runtimes.
- **Control.** The strip is applied at the user config loader, the env-var JSON decoder, the fixture loader, and the theme loader. The strict-root schema closes the top-level gap; this strip closes the gap inside `additionalProperties: true` carve-outs (`palette`, `widget.options`).

## I-06 · External commands are argv-style, never shell-concat

- **Invariant.** The `command` widget (and any internal `git` call) is invoked with an argv list; user-supplied data NEVER gets concatenated into a shell command line.
- **Threat.** Shell injection via a cwd containing a backtick, a model id containing `;`, etc.
- **Control.** Spawn APIs that take an argv array; lint rule that forbids `exec`/`system`-style shell invocations in the render path.

## I-07 · External command timeout

- **Invariant.** Custom-command widgets have a default 250 ms timeout, capped at 2 000 ms per widget.
- **Threat.** A hanging external command stalls every prompt render until killed manually.
- **Control.** Timeout enforced at the spawn boundary; timeout produces the widget's `onError` placeholder.

## I-08 · No remote schemas or templates fetched at runtime

- **Invariant.** The renderer never fetches a schema, theme, or template from a URL at runtime.
- **Threat.** Tampered-with remote artefact.
- **Control.** Schemas embedded at build time. Themes are either embedded or read from the local themes directory under the host config root.

## I-09 · Reversible install with byte-checksummed backup

- **Invariant.** Every install-time mutation of host state has a paired backup. Uninstall verifies the checksum before restoring.
- **Threat.** A corrupted or tampered backup file restores the user to an unexpected state.
- **Control.** Backup carries a SHA-256 over the canonicalised JSON of the prior value; uninstall recomputes and refuses to restore on mismatch.

## I-10 · No postinstall scripts that touch host fs outside the package

- **Invariant.** The package descriptor's lifecycle scripts do not write outside the package's own install directory.
- **Threat.** A compromised dependency runs arbitrary code with the user's privileges.
- **Control.** Lint rule on the package descriptor; CI rejects unknown postinstall fields.

## I-11 · Runtime deps pinned by exact version; audited on merge

- **Invariant.** Every runtime dependency carries an exact-version specifier. No caret/tilde ranges. Audit runs in CI; high-severity advisories block merge.
- **Threat.** Transitive supply-chain compromise.
- **Control.** Dependency-policy lint; CI step that runs `<registry> audit --omit=dev` (or stack equivalent).

## I-12 · Signed releases with provenance

- **Invariant.** Every published release artefact is signed and carries a provenance attestation linking it to the source commit it was built from.
- **Threat.** A registry account compromise lets an attacker publish a malicious version.
- **Control.** OIDC-issued signing in the release workflow; no long-lived secrets in the publish pipeline.

## I-13 · No absolute paths in shipped artefacts

- **Invariant.** Published artefacts contain no `/Users/`, `/home/`, `~/.claude/` literals.
- **Threat.** Information leakage about the maintainer's environment; surprising behaviour when the artefact runs on a different host.
- **Control.** gate-02.

## I-14 · Errors do not leak sensitive data

- **Invariant.** Error messages emitted on stdout / stderr / log files do not include path components from the user's home directory, env-var values that look like secrets, or contents of files the renderer read.
- **Threat.** Error logs uploaded to a third-party tool (a bug tracker, a chat) leak local data.
- **Control.** Error messages reference field names and types, not values. A sanitiser strips home-directory prefixes from any path that appears in user-visible errors.

---

## Secret handling

- **No secrets in source.** Tokens, API keys, credentials never appear in the source tree. CI scanners (secret-scan + custom regex per known service) run on every push.
- **No secrets in CI logs.** Secrets passed to CI jobs come from the platform's secret store, never from repo files; the platform masks them in logs.
- **No long-lived publish credentials.** Use OIDC-issued tokens that scope to a single workflow run.

## Disclosure

`SECURITY` declares the disclosure channel (private SCM advisory) and the SLA (acknowledge within 5 business days; remediation depending on severity).

A reported vulnerability triggers:

1. Acknowledge to the reporter.
2. Reproduce in a private branch.
3. Develop and test a fix in private.
4. Coordinate disclosure date.
5. Publish the fix, advisory, and CHANGELOG entry on the disclosure date.

## What is _not_ part of the threat model

- Arbitrary code execution on the user's host.
- Compromise of the host application itself.
- A user intentionally running a malicious `<bin>` that they downloaded outside the official channel.

For those scenarios, the user is past the boundary the cookbook can defend.
