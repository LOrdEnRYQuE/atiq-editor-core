# ADR-001: QuantumATi uses the VSCodium distribution approach; OpenCode is optional model access

**Decision status:** Accepted by the product owner (2026-11-01)  
**Implementation status:** Not yet verified end to end  
**Repository:** `LOrdEnRYQuE/atiq-editor-core`

## Context

QuantumATi is a standalone, product-first IDE. The owner's required foundation is **VSCodium**, not an OpenCode application.

VSCodium is a build/distribution project that uses the open-source Microsoft `vscode` (Code-OSS) sources and applies community packaging/configuration; it is not a separate editor source-code fork. The current QuantumATi repository contains Code-OSS source files and a custom QuantumATi product identity/extension on a feature branch. Existing CI builds Code-OSS into a macOS app, but **does not yet prove that the VSCodium build/configuration approach, marketplace configuration, telemetry controls, and platform behavior have been adopted**.

OpenCode is an optional tool for reaching compatible LLM providers and locally served models, with priority on genuinely no-fee options. OpenCode is not the IDE foundation, UI shell, security authority, or a mandatory dependency for QuantumATi.

## Decision

1. **Editor and distribution:** Keep real editing, terminals, Git, debugging and extension APIs in the Code-OSS editor, and evolve **QuantumATi as a VSCodium-based distribution** (the VSCodium build/configuration principles and legally compatible extension registry). Preserve an isolated QuantumATi fork. Never change Microsoft's upstream repository.
2. **QuantumATi-owned UX:** Mission Control, Project Intelligence, verification, permissions, project memory and later agent experience are QuantumATi modules built in/above this editor. Their availability must not depend on OpenCode.
3. **Replaceable model-access adapter:** Treat OpenCode only as one optional adapter to selectable LLMs, including currently available free/no-fee models and local inference where supported. A future direct-provider adapter must be possible without changing IDE/UI or losing project state. Do not mandate OpenCode installation for editor startup.
4. **Separate execution authority:** A provider or OpenCode session may propose text/code, but neither grants approval to edit files, execute commands, use networks or deploy. QuantumATi's independent permissions, executor and evidence mechanisms own those actions.
5. **Cost protection:** Budget target is €0. No paid-provider default, paid subscription, billing activation, or automatic fallback from free to billable models. Availability, rate limits and cost are determined per provider/model/account at use time; UI must label unknown cost honestly and fail closed when cost cannot be verified.
6. **Privacy and resilience:** Clearly distinguish local inference from provider-mediated requests. Do not promise that remote free models are private or permanently available. The editor stays usable when OpenCode, model providers, or the network are absent.

## Explicit non-decisions

- No claim that the current repository already packages VSCodium successfully.
- No claim that a given model will remain free or that a local model will run efficiently on every Mac.
- No OpenCode-first shell, standalone OpenCode desktop app, or automatic paid fallback.
- No immediate wholesale rewrite, rebase, removal of existing QuantumATi modules, or merging into `main`.

## Alternatives rejected

- **OpenCode as the editor core:** Rejected; it inverts the required ownership boundaries.
- **Official proprietary Visual Studio Code binaries as the release baseline:** Rejected; use VSCodium's FLOSS-oriented distribution approach.
- **Hard-code one model/provider:** Rejected; would make an optional free-model path a critical dependency.

## Consequences and migration

- Inspect VSCodium's build scripts/configuration and pin an explicit compatible source/toolchain version before changing packaging.
- Reconcile QuantumATi `product.json`, application identity, license, telemetry/network behavior and Open VSX/extension policy with the intended distribution; test rather than assume equivalence.
- Keep existing QuantumATi extension/UI and CI artifacts. Migrate in bounded branches, retaining rollback and avoiding writes to any upstream repository.
- Implement an optional model-access interface only after the IDE can start, open files, and run its own independent UI reliably.

## Verification gates

1. **Editor continuity:** Packaged QuantumATi launches on a supported target, opens a folder, edits/saves a test file, opens a terminal and Git view without OpenCode installed.
2. **Distribution:** GitHub CI identifies source commit and VSCodium-derived packaging/configuration; the built artifact's app identity, license, extension registry and telemetry/network behavior are inspected.
3. **No-cost model access:** With an optional OpenCode connection, select a confirmed free-tier/local model, run a small prompt and show actual provider/model/cost/quota metadata where available. No implied guarantee of permanent availability.
4. **Fail closed:** No provider, expired quota, invalid token, unknown price and network outage never trigger a paid fallback or a false successful agent run.
5. **Security:** LLM output never executes workspace mutations absent separately enforced QuantumATi approval/policy.
6. **Regression:** The IDE opens and edits normally after OpenCode is disabled or removed.

## Follow-up

First close the existing macOS Intel CLI/build gate; then inspect and adapt VSCodium's distribution workflow in a separate bounded change. Defer optional OpenCode/model access until the editor foundation is verified.
