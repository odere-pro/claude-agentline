# OSS-Fuzz application checklist

agentline ships an in-repo [ClusterFuzzLite](https://google.github.io/clusterfuzzlite/)
harness under `.clusterfuzzlite/` and `fast-check` property tests under
`tests/fuzz/`. That already satisfies the OpenSSF Scorecard **Fuzzing** check.

To additionally enroll in the **hosted** [OSS-Fuzz](https://google.github.io/oss-fuzz/)
service (continuous fuzzing on Google infrastructure with automatic bug
filing), open a pull request against
[`google/oss-fuzz`](https://github.com/google/oss-fuzz) adding a
`projects/agentline/` directory. The work below is upstream — it does not live
in this repository.

## What the upstream PR contains

The hosted service reuses the same harness this repo already has. Copy the
proven files from `.clusterfuzzlite/` into `projects/agentline/` in the
oss-fuzz repo and add a `project.yaml`.

### `projects/agentline/project.yaml`

```yaml
homepage: "https://github.com/odere-pro/claude-agentline"
language: javascript
primary_contact: "odere.pub@gmail.com"
main_repo: "https://github.com/odere-pro/claude-agentline"
fuzzing_engines:
  - libfuzzer
sanitizers:
  - address
```

### `projects/agentline/Dockerfile`

Mirror `.clusterfuzzlite/Dockerfile` — base off
`gcr.io/oss-fuzz-base/base-builder-javascript`, clone `main_repo`, and copy
`build.sh` in.

### `projects/agentline/build.sh`

Mirror `.clusterfuzzlite/build.sh` — install deps, compile TypeScript, then
`compile_javascript_fuzzer` each target in `.clusterfuzzlite/fuzz/`.

## Process

1. Fork `google/oss-fuzz`.
2. Add the three files above under `projects/agentline/`.
3. Verify locally with the OSS-Fuzz helper:

   ```bash
   python infra/helper.py build_image agentline
   python infra/helper.py build_fuzzers agentline
   python infra/helper.py check_build agentline
   python infra/helper.py run_fuzzer agentline fuzz_stdin_json
   ```

4. Open the PR. An OSS-Fuzz maintainer reviews the `primary_contact` and
   project scope before merging — only verified maintainers of the target repo
   are accepted.
5. After merge, the repo name appears in the OSS-Fuzz project list, which is
   exactly what Scorecard's Fuzzing check queries.

## Fuzz targets

The same three parsers exercised by `tests/fuzz/` and `.clusterfuzzlite/fuzz/`:

| Target                 | Wraps                                                |
| ---------------------- | ---------------------------------------------------- |
| `fuzz_stdin_json`      | the stdin JSON parser (`src/core/stdin/`)            |
| `fuzz_config_validate` | the ajv-backed config validator (`src/data/config/`) |
| `fuzz_transcript`      | the transcript parser (`src/data/tokens/`)           |
