# QuantumATi macOS footprint and compression audit — 2026-11-01

## Evidence
- Successful macOS Intel build: https://github.com/LOrdEnRYQuE/atiq-editor-core/actions/runs/41320013356
- Published artifact size: 168,743,011 bytes (GitHub Actions artifact, not unpacked app size).
- The previous preview ZIP was listed as approximately 161 MiB in CI logs. No measured 6–7 GB installed-app size exists; that number may refer to a source checkout and dependencies.
- Separate build workspace vs installed app. Do not reduce application functionality based on the size of developer dependencies.
- No MacBook or Desktop files were read, moved or deleted.

## Safe optimization experiment
The separate `quantumati-macos-compact.yml` workflow downloads the original successful preview ZIP, verifies its SHA-256, extracts it, measures directory/file sizes and recompresses the *unchanged* app bundle with macOS `ditto` at zlib level 9. After extraction, it checks every directory, symlink and regular file, SHA-256 contents, permissions and native executable CLI version. It uploads a compact artifact **only when smaller**, with checksum and JSON footprint report.

This does NOT remove localization, debugging, Git, terminal, extensions, accessibility assets, licenses, or executables. It also does not establish actual GUI launch, notarization or Gatekeeper acceptance.

## Next development-workspace measurement
On a dedicated authorized development machine or ephemeral GitHub runner, measure `du -sh` of the source checkout, `node_modules`, `.git`, compiled output, extension dependencies and caches. Avoid copying these build-only directories into distribution artifacts. Refrain from running cleanup commands on a user's Mac without explicit permission.

## Status
CI run and measured savings must be verified before claiming the optimized artifact is ready. A ZIP format cannot reduce memory consumption; install size and RAM are independent metrics.
