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
