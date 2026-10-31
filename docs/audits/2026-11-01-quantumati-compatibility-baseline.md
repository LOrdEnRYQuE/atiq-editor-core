# QuantumATi — Code-OSS compatibility baseline

Date: 2026-11-01  
Repository: https://github.com/LOrdEnRYQuE/atiq-editor-core  
Scope: read-only repository/source/CI inspection, not a full desktop audit.  
Verdict: **NOT RELEASE READY**.

## Findings

| ID | Finding | Status | Evidence / impact |
|---|---|---|---|
| QAT-001 | Base remains Code-OSS 1.110.0 | OUTDATED | Root package.json on main and feature declares 1.110.0. VS Code stable 1.144.0 shipped 2026-10-28: https://code.visualstudio.com/updates/v1_144. Upgrade is a significant untested migration. |
| QAT-002 | Root product is not QuantumATi-branded | NOT BRANDED | product.json still declares Code - OSS and code-oss. QuantumATi UI exists as an extension, not a verified standalone distribution. |
| QAT-003 | Desktop startup / full Code-OSS build | UNVERIFIED | Existing Node tests do not constitute a desktop build, extension activation or packaging validation. |
| QAT-004 | Inherited PR CI permissions workflow | FAILED | .github/workflows/no-engineering-system-changes.yml queries microsoft/vscode rather than the QuantumATi repository. GitHub Actions returned HTTP 403: https://github.com/LOrdEnRYQuE/atiq-editor-core/actions/runs/41248580296. Redesign permission checks; do not disable protection. |
| QAT-005 | Marketplace compatibility and licensing | UNVERIFIED | No extensionsGallery is declared in product.json. Presence/absence of registry metadata does not prove licensing or catalog compatibility. Prefer legally usable Open VSX integration. |
| QAT-006 | Telemetry and privacy | UNVERIFIED | Static metadata cannot prove absence of network requests, extension telemetry or LLM-provider egress. Requires monitored runtime tests. |
| QAT-007 | Existing Product Digital Twin | PARTIAL | 32 earlier focused tests passed: https://github.com/LOrdEnRYQuE/atiq-editor-core/actions/runs/41249119352. Not proof of complete desktop or trusted verification. |
| QAT-008 | Trusted verification runner | NOT IMPLEMENTED ON CHECKED BRANCH | The named feature branch exists but the verification-runner.cjs file was not present at inspection. Names of branches are not implementation evidence. |

## Runnable read-only audit

Run from the repository root:

    node extensions/quantumati-control-center/compatibility-preflight.cjs 1.144.0

The argument is an explicitly supplied release-reference version, not a live update feed. The machine-readable JSON result distinguishes observed metadata from unverified claims.

The tool checks: source version, branding fields, declared extension engine, known upstream CI coupling and registry presence. It **always reports releaseReady:false**, and treats privacy and desktop readiness as UNVERIFIED until independent evidence exists. No network calls, file modifications or automatic upgrades are performed.

## Plan — lowest risk first

1. Preserve release and permission safety: fix inherited CI guard only after designing a repository-appropriate authorization rule. Do not swap URLs without checking token permissions.
2. Compare Code-OSS API, Webview, Electron/Node and built-in extension changes against a chosen modern baseline. Isolate changes; do not upgrade main directly.
3. Prove a full desktop build, extension activation and restart behavior on an actual supported desktop OS before release claims.
4. Test telemetry/network egress in offline and provider-connected modes; test Open VSX extension compatibility and actual license terms.
5. Add reproducible performance benchmarks before advertising improvements to RAM, CPU or startup speed.

No production modifications, paid services, remote Mac access or merge to main occurred in this audit.
