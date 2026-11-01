# ADR-001: QuantumATi uses the VSCodium distribution approach; OpenCode is optional model access

**Decision status:** Accepted by the product owner (2026-11-01)  
**Implementation status:** Not yet verified end to end  
**Repository:** `LOrdEnRYQuE/atiq-editor-core`

## Context

QuantumATi is a standalone, product-first IDE. The owner's required foundation is **VSCodium**, not an OpenCode application.

VSCodium is a build/distribution project that uses the open-source Microsoft `vscode` (Code-OSS) sources and applies community packaging/configuration; it is not a separate editor source-code fork. The current QuantumATi repository contains Code-OSS source files and a custom QuantumATi product identity/extension on a feature branch. Existing CI builds Code-OSS into a macOS app, but **does not yet prove that the VSCodium build/configuration approach, marketplace configuration, telemetry controls, and platform behavior have been adopted**.

OpenCode is an optional model-access adapter; it is not the IDE foundation or a mandatory dependency. **QuantumATi is a commercial client-facing product:** end customers can use free/local models and purchase access to premium AI models **from QuantumATi itself**, without needing provider API accounts or their own API keys. Optional BYOK remains an alternative, not a prerequisite. The project's current EUR 0 **development budget** is independent of customer-paid model access.

## Decision

1. **Editor and distribution:** Keep real editing, terminals, Git, debugging and extension APIs in the Code-OSS editor, and evolve **QuantumATi as a VSCodium-based distribution** (the VSCodium build/configuration principles and legally compatible extension registry). Preserve an isolated QuantumATi fork. Never change Microsoft's upstream repository.
2. **QuantumATi-owned UX:** Mission Control, Project Intelligence, verification, permissions, project memory and later agent experience are QuantumATi modules built in/above this editor. Their availability must not depend on OpenCode.
3. **Client-facing commercial model catalog:** Support free/local and **QuantumATi-managed paid premium** LLMs as first-class selectable options. An authenticated QuantumATi customer buys a paid plan and/or prepaid usage credits via QuantumATi and receives usage entitlements. QuantumATi routes eligible premium requests through a server-side AI gateway using **platform-controlled provider credentials**, never credentials shipped in the desktop app. Customers do **not** need individual provider accounts. Optional BYOK (customer-owned key billed by the upstream provider) is a separate advanced access mode. OpenCode can provide an optional adapter, while direct-provider adapters are independent. Catalog entries must declare provider/model, capabilities, availability, price presentation and data egress; unknown or outdated prices cannot be represented as free.
4. **Separate execution authority:** A provider or OpenCode session may propose text/code, but neither grants approval to edit files, execute commands, use networks or deploy. QuantumATi's independent permissions, executor and evidence mechanisms own those actions.
5. **Distinct developer vs customer budgets and payment authority:** The owner's current **€0 development-spending constraint** applies to QuantumATi implementation operations, not to a customer's voluntary purchase of premium access. The commercial system supports **paid plans and/or prepaid usage credits** with actual pricing, allowances and taxes to be decided and displayed before checkout; no prices are invented. After a verified payment/entitlement activation, the client can use the purchased premium models **without repeated per-prompt confirmations** while staying inside a plan/credit and optional spend limit. Backend policy checks every request, reserves metered allowance/credits atomically, settles actual usage or releases unused reservations, handles timeouts and duplicates idempotently, and blocks usage when payment, entitlement, pricing or balance is invalid. Never activate billing, change to a more expensive model, exceed client-approved limits, or silently convert free use to paid use. Provider prices/availability and resale or embedded-service rights must be verified before launch; platform margins and upstream spend need separate accounting. Neither a provider account nor BYOK is required for the platform-managed paid mode.
6. **Privacy, tenancy and resilience:** Clearly distinguish local inference from free/premium remote-provider requests, including the exact customer-consented data egress policy. Multi-tenant identity, subscriptions/credit balances, usage ledgers and provider API secrets are owned by QuantumATi's **server-side control plane**, not local extension settings. Isolate customers/tenants and never ship platform secrets in the IDE or logs. Store optional BYOK credentials separately and securely. The editor remains functional offline or when a provider is unavailable; an outage cannot trigger unapproved paid fallback. Payment processor event replay, refunds and chargebacks must reconcile with entitlements before new premium consumption is authorized.

## Explicit non-decisions

- No claim that the current repository already packages VSCodium successfully.
- No claim that a given model will remain free or that a local model will run efficiently on every Mac.
- No OpenCode-first shell, standalone OpenCode desktop app, or automatic paid fallback.
- No assumption that upstream API access automatically grants redistribution, resale or white-label rights; commercial eligibility needs provider-specific verification.
- No invented subscription prices, included token allowances, payment processor or fee percentage without a separate product decision.
- No immediate wholesale rewrite, rebase, removal of existing QuantumATi modules, or merging into `main`.

## Alternatives rejected

- **OpenCode as the editor core:** Rejected; it inverts the required ownership boundaries.
- **Official proprietary Visual Studio Code binaries as the release baseline:** Rejected; use VSCodium's FLOSS-oriented distribution approach.
- **Hard-code one model/provider:** Rejected; QuantumATi must support both no-cost and premium model choices through replaceable adapters.
- **Premium access only via customer API keys (BYOK-only):** Rejected; paying QuantumATi customers must be able to purchase platform-managed premium model usage directly.
- **Automatic premium fallback:** Rejected; changing cost class requires client-approved entitlement and an enforced budget policy.
- **Bundling provider API keys into the desktop app:** Rejected; platform-managed premium requests use a protected backend gateway.

## Consequences and migration

- Inspect VSCodium's build scripts/configuration and pin an explicit compatible source/toolchain version before changing packaging.
- Reconcile QuantumATi `product.json`, application identity, license, telemetry/network behavior and Open VSX/extension policy with the intended distribution; test rather than assume equivalence.
- Keep existing QuantumATi extension/UI and CI artifacts. Migrate in bounded branches, retaining rollback and avoiding writes to any upstream repository.
- Implement an optional model-access interface only after the IDE can start, open files, and run its own independent UI reliably.
- Provide model selection in the QuantumATi UI with clear **Free / Local / Premium (available with QuantumATi plan or credits)** categories and actual eligibility/status. A client may upgrade/purchase a plan or credits inside the customer experience; after payment is confirmed, previously authorized usage within allowances needs no per-request checkout pop-up. **BYOK is optional**. A customer's QuantumATi premium plan is distinct from an upstream API account or consumer chat subscription.
- Provide an authenticated customer/tenant API, server-side model gateway, usage authorization, payment-webhook reconciliation, metering, invoice/receipt and customer-facing balance/cost transparency, with provider terms and applicable regulatory obligations checked before offering paid services.

## Verification gates

1. **Editor continuity:** Packaged QuantumATi launches on a supported target, opens a folder, edits/saves a test file, opens a terminal and Git view without OpenCode installed.
2. **Distribution:** GitHub CI identifies source commit and VSCodium-derived packaging/configuration; the built artifact's app identity, license, extension registry and telemetry/network behavior are inspected.
3. **No-cost model access:** With an optional OpenCode or direct-provider adapter, select a confirmed free-tier/local model, run a small prompt and show actual provider/model/cost/quota metadata where available. No implied guarantee of permanent availability.
4. **Client-purchased premium model access:** In a test environment with a *simulated* successful QuantumATi payment and isolated customer entitlement, select an eligible premium model **without a customer-supplied provider API key**; assert routing through the server gateway, tenant isolation, reservation/metering/settlement, exhaustion handling, refunds, webhook idempotency and no secret leakage. Any real paid provider call or live payment requires explicit separate authorization and applicable commercial rights.
5. **Fail closed:** Missing or reversed payment, missing tenant entitlement, expired plan, exhausted credits, duplicate webhook, missing provider, invalid token, unknown price or network outage must not grant premium access, overcharge a customer, trigger paid fallback or falsely report success.
6. **Security:** LLM output never executes workspace mutations absent separately enforced QuantumATi approval/policy; model selection grants no additional tool permissions.
7. **Regression:** The IDE opens and edits normally after OpenCode is disabled or removed, and when premium providers are not configured.

## Follow-up

First close the existing macOS Intel CLI/build gate; then inspect and adapt VSCodium's distribution workflow in a separate bounded change. Defer optional OpenCode/model access until the editor foundation is verified.
