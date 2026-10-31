# QuantumATi — Project Control Center (first vertical slice)

Implemented on an isolated branch of the existing Code-OSS repository. This is an **initial read-only integrated extension**, not the full replacement shell.

- Opens a product-first webview at extension activation (onStartupFinished).
- Inspects the first local workspace, reading only a small ordinary package.json file.
- Displays discovered project information and npm script names; never executes them.
- Tests/builds remain NOT_RUN until real verification is connected.
- Includes an advisory fail-closed permission policy; it is **not** a security enforcement boundary.
- Adds commands to open and refresh the control center.

Run pure Node tests: `node --test extensions/quantumati-control-center/test/*.test.cjs` from repository root.

## Not built yet
OpenCode integration, executable agents, true sandbox isolation, trusted permission enforcement, native QuantumATi-branded build, and end-to-end desktop startup verification.

The default Code-OSS branch, production systems, and published packages are unchanged.


## Product Digital Twin — read-only prototype

The `product-twin.cjs` adapter accepts an optional `.quantumati/product.json` capability model, correlates declared sources with SHA-256 fingerprints, and marks recorded evidence as `STALE` when those sources change. The result is presented in **Project Intelligence** and **Verification Center**.

See [PRODUCT_TWIN.md](PRODUCT_TWIN.md) for the schema, supported states, security limits and test command. No untrusted report can grant `VERIFIED`; the trusted evidence runner is not built. The Code-OSS desktop runtime is not yet verified.


## Compatibility Preflight (read-only)

Run from the repository root:

    node extensions/quantumati-control-center/compatibility-preflight.cjs 1.144.0

This emits a JSON report comparing the declared Code-OSS version with an **explicit reference version** and checking static branding, extension engine, known upstream-coupled CI configuration, and registry metadata. It does not update files or make network requests. Privacy, actual extension startup, and desktop release readiness remain **UNVERIFIED** until independently tested.

See [the dated Code-OSS compatibility audit](../../docs/audits/2026-11-01-quantumati-compatibility-baseline.md) for findings and the staged upgrade plan. Do not interpret passing Node tests as a desktop build or release certification.


## Durable Missions v1 — read-only prototype

The `mission-recovery.cjs` module persists bounded read-only missions and SHA-256 evidence, supports recovery after a separate Node process restarts, and handles concurrent readers, expirations, changed files and private event-store permissions.

Run: `node --test extensions/quantumati-control-center/test/*.test.cjs`

[Architecture, test scenarios and limitations](../../docs/specs/2026-11-01-quantumati-durable-missions-v1.md).

**Not yet available:** authenticated human approvals, real autonomous code edits, trusted sandboxing, live AI agents, background execution when a laptop is off, and an end-to-end Code-OSS desktop experience. The library itself never executes paid, network or destructive operations.
