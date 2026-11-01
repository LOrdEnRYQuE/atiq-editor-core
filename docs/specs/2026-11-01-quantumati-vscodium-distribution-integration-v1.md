# QuantumATi — VSCodium-style distribution integration, slice 1

**Status:** static distribution metadata implementation; desktop runtime **NOT VERIFIED**.

QuantumATi retains the Code-OSS editor, while adopting VSCodium's independent distribution principles incrementally. VSCodium itself is a build/distribution system using Code-OSS source, not a replacement editor core.

## Implemented in this branch

- QuantumATi's `product.json` uses the Open VSX gallery endpoints from the VSCodium `prepare_vscode.sh` configuration reviewed on 2026-11-01.
- QuantumATi retains independent application identifiers and does not inherit VSCodium/Microsoft update or download URLs. Automatic updates remain unconfigured.
- `scripts/quantumati/vscodium-distribution.cjs` validates product identity, gallery, license declaration and update isolation without altering files or making any network calls.
- The Node test suite includes success and failure cases plus a direct repository product manifest check. GitHub Actions runs the same checks.

## Not yet verified

- Native VSCodium build-script/patch compatibility, runtime telemetry controls, Open VSX extension installation and licensing, macOS interactive editing, Gatekeeper/signing, Linux/Windows packages.
- A static metadata pass **must not** be construed as VSCodium parity or release readiness.
- OpenCode remains optional as a route to free-tier/local LLMs; this distribution slice does not install it or incur charges.

## Read-only verification

`node --test scripts/quantumati/test/*.test.cjs`

`node scripts/quantumati/vscodium-distribution.cjs product.json`

A passing report uses `configValid: true` while deliberately retaining `releaseReady: false`, `telemetry: UNVERIFIED` and `desktop_runtime: UNVERIFIED`.

References: https://github.com/VSCodium/vscodium and https://github.com/VSCodium/vscodium/blob/master/prepare_vscode.sh .
