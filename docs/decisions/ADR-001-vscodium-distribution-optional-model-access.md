# ADR-001: QuantumATi uses the VSCodium distribution approach; OpenCode is optional model access

**Decision status:** Accepted by the product owner (2026-11-01)  
**Implementation status:** Not yet verified end to end  
**Repository:** `LOrdEnRYQuE/atiq-editor-core`

## Context

QuantumATi is a standalone, product-first IDE. The owner's required foundation is **VSCodium**, not an OpenCode application.

VSCodium is a build/distribution project that uses the open-source Microsoft `vscode` (Code-OSS) sources and applies community packaging/configuration; it is not a separate editor source-code fork. The current QuantumATi repository contains Code-OSS source files and a custom QuantumATi product identity/extension on a feature branch. Existing CI builds Code-OSS into a macOS app, but **does not yet prove that the VSCodium build/configuration approach, marketplace configuration, telemetry controls, and platform behavior have been adopted**.

OpenCode is an optional tool for reaching compatible LLM providers and locally served models. **QuantumATi must support both free and premium LLMs**, with free/local options usable at a zero-euro budget and premium models explicitly selectable when the user independently enables a paid API account. OpenCode is not the IDE foundation, UI shell, security authority, or a mandatory dependency for QuantumATi.

## Decision

1. **Editor and distribution:** Keep real editing, terminals, Git, debugging and extension APIs in the Code-OSS editor, and evolve **QuantumATi as a VSCodium-based distribution** (the VSCodium build/configuration principles and legally compatible extension registry). Preserve an isolated QuantumATi fork. Never change Microsoft's upstream repository.
2. **QuantumATi-owned UX:** Mission Control, Project Intelligence, verification, permissions, project memory and later agent experience are QuantumATi modules built in/above this editor. Their availability must not depend on OpenCode.
3. **Replaceable multi-provider model-access layer:** Support **free-tier, local and premium paid-API models**, selected by the user per mission or request. OpenCode is only one optional model adapter, alongside future direct provider adapters; it must never replace the editor or become required for IDE startup. Models are described by provider, identifier, capabilities, context limits, privacy/egress requirements, current quota and pricing confidence. Unknown or stale pricing must not be shown as zero.
4. **Separate execution authority:** A provider or OpenCode session may propose text/code, but neither grants approval to edit files, execute commands, use networks or deploy. QuantumATi's independent permissions, executor and evidence mechanisms own those actions.
5. **Free and premium cost protection:** The current default budget remains **€0**. Premium APIs are supported **only after the user explicitly opts in**, supplies their own authorized credentials (BYOK or another explicitly approved entitlement) and configures an allowed budget; merely selecting a premium model or adding credentials cannot silently start billing. Before each billable request, show provider/model and a conservative cost estimate, enforce the locally configured per-request and total spending limits to the extent supported, and record estimated versus observed usage. Provider-side hard limits are preferable; local accounting cannot guarantee a provider's final bill. **Never automatically fall back from free to paid, change to a more expensive premium model, activate a subscription, or create a paid account without explicit permission.** Rate limits, API pricing and eligibility must be checked per provider/model/account at usage time; unknown cost fails closed.
6. **Privacy and resilience:** Clearly distinguish local inference from free or premium remote-provider requests and disclose data egress. Do not promise that remote models are private or permanently available. Store provider secrets outside workspace files, logs and Git (OS credential storage when available). The editor stays usable when OpenCode, model providers, or the network are absent; loss of a free tier must not cause unexpected charges.

## Explicit non-decisions

- No claim that the current repository already packages VSCodium successfully.
- No claim that a given model will remain free or that a local model will run efficiently on every Mac.
- No OpenCode-first shell, standalone OpenCode desktop app, or automatic paid fallback.
- No immediate wholesale rewrite, rebase, removal of existing QuantumATi modules, or merging into `main`.

## Alternatives rejected

- **OpenCode as the editor core:** Rejected; it inverts the required ownership boundaries.
- **Official proprietary Visual Studio Code binaries as the release baseline:** Rejected; use VSCodium's FLOSS-oriented distribution approach.
- **Hard-code one model/provider:** Rejected; QuantumATi must support both no-cost and premium model choices through replaceable adapters.
- **Automatic premium fallback:** Rejected; changing cost class requires the user's explicit consent and an enforced budget policy.

## Consequences and migration

- Inspect VSCodium's build scripts/configuration and pin an explicit compatible source/toolchain version before changing packaging.
- Reconcile QuantumATi `product.json`, application identity, license, telemetry/network behavior and Open VSX/extension policy with the intended distribution; test rather than assume equivalence.
- Keep existing QuantumATi extension/UI and CI artifacts. Migrate in bounded branches, retaining rollback and avoiding writes to any upstream repository.
- Implement an optional model-access interface only after the IDE can start, open files, and run its own independent UI reliably.
- Provide model selection in the QuantumATi UI with clear **Free / Local / Premium** categories, real connection status, explicit billable-request authorization and no automatic cost-class escalation. An API key, an API account with credit, and a consumer chat subscription are distinct; never assume a chat subscription includes API usage.

## Verification gates

1. **Editor continuity:** Packaged QuantumATi launches on a supported target, opens a folder, edits/saves a test file, opens a terminal and Git view without OpenCode installed.
2. **Distribution:** GitHub CI identifies source commit and VSCodium-derived packaging/configuration; the built artifact's app identity, license, extension registry and telemetry/network behavior are inspected.
3. **No-cost model access:** With an optional OpenCode or direct-provider adapter, select a confirmed free-tier/local model, run a small prompt and show actual provider/model/cost/quota metadata where available. No implied guarantee of permanent availability.
4. **Premium model access:** In an isolated, explicitly authorized test with a user-supplied paid API account and capped budget, select a premium model, confirm the estimated cost and data egress, send a bounded prompt and show the actual usage/result; no charged test is run without separate authorization.
5. **Fail closed:** No provider, expired quota, invalid token, unknown price, exceeded budget and network outage never trigger a paid fallback or a false successful agent run.
6. **Security:** LLM output never executes workspace mutations absent separately enforced QuantumATi approval/policy; model selection grants no additional tool permissions.
7. **Regression:** The IDE opens and edits normally after OpenCode is disabled or removed, and when premium providers are not configured.

## Follow-up

First close the existing macOS Intel CLI/build gate; then inspect and adapt VSCodium's distribution workflow in a separate bounded change. Defer optional OpenCode/model access until the editor foundation is verified.
