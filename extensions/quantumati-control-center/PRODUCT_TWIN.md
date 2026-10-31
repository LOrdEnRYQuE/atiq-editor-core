# QuantumATi Product Digital Twin — First Read-Only Vertical Slice

**Status:** Prototype with actual source inspection and evidence fingerprinting. This is **not** a trusted test runner or complete Product Intelligence Engine.

## What it does

QuantumATi reads a user-declared capability model at `.quantumati/product.json`, follows explicitly declared local source files (within a strict size/path allowlist), hashes their contents with SHA-256 and compares them with optional recorded test metadata in `.quantumati/evidence.json`.

The inspection is passed to the existing `inspectProject()` adapter and rendered in Mission Control under **Project Intelligence**, with related information in **Verification Center**.

It does not infer features from arbitrary source code, execute test commands, modify project files or contact any external LLM provider.

## Product model v1 example

```json
{
  "version": 1,
  "capabilities": [
    {
      "id": "login",
      "title": "User sign-in",
      "sources": ["src/login.js", "src/login.test.js"]
    }
  ]
}
```

Use only relative forward-slash source paths. The manifest accepts up to 100 capabilities and 16 sources per capability. Every source must resolve to a normal local file; sensitive names such as `.env`, `.git`, `.ssh` and `credentials.json` are rejected. Symbolic links and paths outside the workspace are not followed. These controls are **read-only safeguards**, not an OS-level sandbox or a guarantee against filesystem races.

## Optional evidence v1 contract

```json
{
  "version": 1,
  "proofs": [
    {
      "capabilityId": "login",
      "fingerprint": "64-character-hex-source-digest",
      "runId": "an-external-run-id",
      "recordedAt": "2026-10-31T20:00:00Z",
      "exitCode": 0
    }
  ]
}
```

**Important:** workspace evidence is user-editable and untrusted. It only supports `PASS_RECORDED` or `FAILED_RECORDED`, never `VERIFIED`. A future trusted runner must independently execute checks and attest evidence before the status can become verified. Self-declared `trusted` or `verified` flags are ignored.

## Truth-state matrix

| State | Meaning |
| --- | --- |
| `NO_MODEL` | No product model declared |
| `PARTIAL` | Model/evidence could not be safely understood |
| `IMPLEMENTATION_FOUND` | All referenced source files exist, but no valid proof recorded |
| `MISSING_SOURCE` | A required source is missing and no previous proof exists |
| `BLOCKED` | Source could not be safely inspected (e.g., symlink) |
| `PASS_RECORDED` | An untrusted reported successful run matches current source fingerprint |
| `FAILED_RECORDED` | An untrusted reported failing run matches current source fingerprint |
| `STALE` | Source changed or was deleted after the recorded run |
| `NOT_VERIFIED` | This implementation cannot yet establish verified feature completion |

A passing `node --test` for QuantumATi's own module is evidence of the module's behavior, **not** proof of a user's feature being complete.

## Test commands

```bash
node --check extensions/quantumati-control-center/product-twin.cjs
node --test extensions/quantumati-control-center/test/*.test.cjs
```

CI: `.github/workflows/quantumati-product-twin.yml`.

## Next engineering gate

Implement a trusted test runner in an isolated workspace and associate each proof with exact command, process exit, environment, monotonic event ID, source fingerprint and runner identity. The verifier must reject replayed, stale, manipulated or externally submitted claims. This must pass negative security tests before any UI may display `VERIFIED`.

Desktop build, actual Code-OSS startup, and end-to-end UI rendering are **not yet verified**. All code lives on `feature/quantumati-product-twin-v1`; no production changes or merge occurred.
