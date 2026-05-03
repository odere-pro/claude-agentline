<!-- sha: d3053f0 -->

Unblock the install/init/doctor/uninstall gate suite ahead of the real bodies: adds skeletons for `scripts/{install,init,doctor,uninstall}.sh` plus the shared `scripts/lib/common.sh` (logging, OS detect, Node ≥20 check, EXIT cleanup trap, guarded `al_safe_rm`) that parse documented flags and exit 0. Lands `gate-04-init-idempotency` (two consecutive runs against an isolated `$CLAUDE_PROJECT_DIR` sandbox must produce byte-identical snapshots) and flips `gate-01-doctor` from skip to pass.
