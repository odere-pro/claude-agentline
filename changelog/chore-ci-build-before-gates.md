<!-- sha: ace097c -->

Make CI faithful to a real install: the gates workflow now runs `npm ci` (or `npm install`) and `npm run build` before invoking `tests/gates/run-all.sh`, so gate 01's doctor wrapper resolves the freshly built `dist/cli.mjs` instead of falling through to a non-existent published package and failing on every host.
