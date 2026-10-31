# QuantumATi Mission Control — Implementation Blueprint v1.0

**Status:** Design-level implementation blueprint, for review; no implementation authorized by this file
**Date:** 2026-10-31
**Related UI specification:** ../specs/2026-10-31-quantumati-uiux-v1.md
**Current codebase:** LOrdEnRYQuE/atiq-editor-core / feature/quantumati-project-control-center
**Budget constraint:** $0 incremental cash spending; avoid new paid services, hosted LLM calls and large unapproved CI workloads.

## 1. Objective and narrow definition of done

Transform the existing read-only QuantumATi webview into a coherent, branded, accessible, honest Project Control Center **inside a real Code-OSS desktop runtime**, without deleting native editor functionality.

Release is NOT complete simply because a webview HTML snapshot or a set of unit tests passes. Initial slice is done only when the extension loads in a real desktop instance, workspace inspection is displayed accurately, keyboard navigation works, and UI/extension contracts are tested.

Future target: QuantumATi replaces the *working experience* via deeper workbench integration. The initial extension path is a safe vertical slice, not an assertion that an extension can replace all native editor chrome.

## 2. Three architecture approaches and selection

| Approach | Benefit | Cost/risk | Decision |
|---|---|---|---|
| Extension-only webview | Rapid low-risk visual progress, easy read-only tests | Limited control over native workbench layout | **UI v1** |
| Direct deep Code-OSS workbench changes | Own shell, navigation semantics, startup layout | Larger rebase burden, costly desktop regression testing | **UI v2, after proof** |
| Standalone Electron shell embedding editor | Maximum branding control | Duplicates shell, integration and security complexities | Not selected |

Recommended sequence: validate a complete product-first view as an extension, then incrementally move stable UI contracts into native workbench services. Do not rename the entire distro or install remote agents as part of UI v1.

## 3. Verified current implementation baseline

- extensions/quantumati-control-center/package.json declares extension entrypoint extension.cjs, onStartupFinished, and open/refresh commands.
- dashboard.cjs produces a single HTML string and exposes a read-only status display.
- project-state.cjs reads an ordinary local package.json manifest only.
- permission-policy.cjs is advisory (not a trusted security enforcement layer).
- A GitHub Actions workflow exercises syntax and isolated Node tests, but it does not compile the complete Code-OSS desktop binary or prove actual webview startup.
- Pull request #1 is Draft against main.

Do not invent work already implemented. Use the baseline above as the starting design dependency.

## 4. Module boundaries

### 4.1 UI App Shell
Owns layout, responsive breakpoints, focus management, view routing, theme tokens and local non-authoritative presentation state. It **never** edits workspace files or executes shell commands.

### 4.2 Project State Adapter
Reads allowlisted project facts through an explicit service. Returns source metadata and inspection outcome. It does not claim builds/tests were executed. Remote and virtual workspace support must be separately implemented; a local filesystem adapter must not silently inspect a remote path.

### 4.3 Extension Host Controller
Registers commands, controls webview lifecycle and validates messages. All callbacks are disposed at panel close; late messages are ignored. It prevents stale/duplicate updates from altering the current panel.

### 4.4 Read-Only Evidence Adapter
Normalizes observed evidence into UI statuses: OBSERVED, INFERRED, UNKNOWN, NOT_RUN, PASSED, FAILED, STALE. The only sources in first slice are local project artifacts and the actual lifecycle state of the extension. Inference is explicitly labeled.

### 4.5 Permission Presentation Adapter
Formats a permission decision from the advisory policy as an explanation, not an executable approval capability. In v1, there is no host command exposed that can perform writes, shell execution, Git push or network actions from the UI.

### 4.6 Future trusted services (no v1 implementation claim)
Mission Orchestrator, OpenCode Gateway, Capability Broker, Sandbox Executor, Verification Runner, Event Store, Approval Ledger. Design their contracts now; build them as separate milestones with security proofs before enabling executable controls.

## 5. Proposed repository structure (incremental migration)

    extensions/quantumati-control-center/
      package.json
      extension.cjs                    # extension host entrypoint
      project-state.cjs                # read-only inventory adapter
      permission-policy.cjs            # advisory policy, explicit limitation
      dashboard.cjs                    # current prototype; retire gradually
      src/
        contracts/
          host-messages.js            # runtime validation and protocol version
          state.js                    # status normalization
        host/
          controller.js               # webview lifecycle and command routing
          workspace-adapter.js        # allowlisted evidence collection
        ui/
          shell/
            app.js                    # app layout and view routing
            navigation.js
            command-bar.js
          views/
            overview.js
            project-intelligence.js
            verification.js
            permissions.js
            activity.js
          components/
            status-pill.js
            evidence-card.js
            state-panel.js
            inspector.js
          styles/
            tokens.css
            app.css
      test/
        core.test.cjs
        extension.test.cjs
        policy.test.cjs
        messages.test.cjs
        view-state.test.cjs
        accessibility.test.cjs

This is a target directory design; the listed new paths are not present yet. Prefer a minimal dependency-free renderer first. Introduce React or a complex bundler only after concrete UX complexity justifies it.

## 6. Contracts between webview and extension host

**Message version:** 1. Fields must be schema-validated at runtime; reject unknown privileged action types.

### Request envelope

    {
      version: 1,
      requestId: "uuid",
      type: "ui.refreshInspection",
      payload: { workspaceId: "current" }
    }

Allowed v1 request types:
- ui.refreshInspection — explicit read-only refresh.
- ui.openCode — focus native editor/open command (no mutation).
- ui.selectEvidence — local UI selection; host only if evidence details require read.
- ui.navigate — local navigation; host not needed for purely presentational routes.

Disallowed in v1: ui.executeCommand, ui.writeFile, ui.publish, ui.installAgent, ui.approveAction. Unknown types must be rejected and logged without executing anything.

### Response envelope

    {
      version: 1,
      requestId: "uuid",
      type: "host.inspectionResult",
      payload: {
        snapshotId: "id",
        projectName: "observed name",
        inspectionStatus: "INSPECTED",
        inspectedAt: "ISO-8601 timestamp",
        sources: ["package.json"],
        warnings: [],
        verification: { build: "NOT_RUN", tests: "NOT_RUN" }
      }
    }

Error response:

    {
      version: 1,
      requestId: "uuid",
      type: "host.error",
      payload: { code: "INSPECTION_FAILED", message: "Readable user-facing description" }
    }

Contract obligations: requestId correlates retries, old inspection messages cannot overwrite a newer snapshot, responses have explicit provenance, and errors never map to green success. Use a small allowlist of serializable strings and arrays. Unknown or malformed responses fail safely in the UI.

## 7. State machine and persistence

- Shell state: OVERVIEW, PROJECT, GOALS, AGENTS, VERIFICATION, PERMISSIONS, ACTIVITY, SETTINGS, CODE.
- Inspection: IDLE → LOADING → INSPECTED | PARTIAL | ERROR.
- Verification: NOT_RUN → RUNNING → PASSED | FAILED | BLOCKED; code changes can transition PASSED → STALE.
- Provider: NOT_CONFIGURED → CONNECTING → CONNECTED | DEGRADED | OFFLINE.

Persist only non-sensitive UI preferences in extension storage (last selected view, nav collapsed, theme preference if independent). Do not persist access tokens or raw environment files. Workspace state is reconstructed from permitted sources on reopening. UI event logs must not be represented as a durable audit ledger until actual durable storage exists.

## 8. Interaction details

- First launch: create/reveal panel → mount app shell → load read-only state → show explicit inspection result.
- Initial rendering must distinguish NO_WORKSPACE and PARTIAL before enabling context-aware actions.
- Refresh: disable duplicate dispatch while an inspection is in flight; on completion reconcile requestId and snapshotId.
- Open Code: route to native workspace editor through Code-OSS API; do not use DOM hacks to imitate editor behavior.
- Close panel: dispose listeners; ignore messages tied to old panel generation.
- Reopen: create fresh panel; restore prior view if safe, otherwise OVERVIEW.
- Settings: actual effective autonomy is L1 in this slice, even though desired product default is Adaptive Autonomy.
- Permission review: view explanation only; approving is not an available action until a trusted capability broker exists.

## 9. Security and privacy implementation rules

1. CSP default-src none; nonce-bound scripts; avoid unsafe-inline scripts; use appropriate Code-OSS CSS security pattern.
2. Use vscode-resource URI helpers for local assets if moved to files; no CDN fonts, scripts or remote telemetry in v1.
3. Never interpolate unescaped repo strings into HTML or JavaScript contexts; prefer safe DOM textContent.
4. Extension host validates every webview message; webview is never a security authority.
5. Make trusted workspace and remote workspace capabilities explicit; local-only inspection for initial version.
6. Reject path traversal and disallowed file types. Never add shell execution to the view in this milestone.
7. No unapproved network calls or LLM requests. External-provider UI shows NOT CONNECTED until proved.
8. Treat plugin-provided state as untrusted; all real permissions must be rechecked in the future trusted executor.

## 10. Accessibility implementation

- Semantic heading, navigation and landmark structure in the webview.
- Visible keyboard focus, tab order, roving focus for tab-like nav only when required.
- Tooltips are supplemental, never the only label.
- Reduced motion and high contrast honor host preferences.
- Full zoom and 900 px compact layout must remain usable.
- Functional contrast audits for both text and non-text content.
- Automatable checks can catch missing names/roles; manual keyboard and screen-reader checks remain necessary.

## 11. Delivery phases, milestones and stop gates

### Phase D0 — UI contracts and design alignment
- Freeze v1 screen names, approved token palette and empty-state language.
- Add message-schema tests and state normalization tests before implementing controllers.
- **Gate:** contracts, truth-state rules and no-fake-success cases reviewed.

### Phase D1 — Native extension integration and desktop proof
- Confirm the extension is discovered by Code-OSS in a clean development or packaged build.
- Verify startup panel, no workspace, ordinary workspace, close/reopen, refresh and open-code navigation.
- **Gate:** record actual screenshots/logs and successful desktop runtime walkthrough; if not possible, mark BLOCKED, never call desktop support verified.

### Phase D2 — Mission Control shell and visual system
- Add tokens, rail, top bar, main canvas, inspector, evidence drawer.
- Create Overview and Project Intelligence views using real read-only evidence.
- Present features not connected as clearly disabled or NOT CONNECTED.
- **Gate:** keyboard pass, high-contrast pass, responsive/zoom pass, no invisible controls.

### Phase D3 — Verification and permission read-only UX
- Add Verification view with NOT_RUN states and evidence provenance.
- Add Permission explanations without an executable approval button.
- Add Activity view that only displays actual events.
- **Gate:** tests prove no false PASSED/VERIFIED, no writes or network side effects from navigation.

### Phase D4 — Product-native workbench investigation
- Map native Code-OSS workbench services and extension APIs to the desired navigation.
- Prototype replacement of first-run experience in an isolated branch after desktop proof.
- **Gate:** real cross-platform build and editor parity; ability to revert changes without losing code features.

### Phase D5 — OpenCode and Adaptive Autonomy (future)
- Implement a typed Agent Gateway and an independent trusted Capability Broker.
- No agent mutation until sandbox isolation, approvals and verification are executable and tested.
- **Gate:** negative security tests (path escape, stale approval, denied command, process containment), positive end-to-end mission test with audit evidence.

Phases D4–D5 are **not** inside UI v1 delivery and must have separate specs and review gates.

## 12. Test and verification matrix

| Level | Scenario | Proof |
|---|---|---|
| Unit | normalize NOT_RUN, UNKNOWN, STALE, PARTIAL | deterministic assertions |
| Unit | render untrusted strings safely | injection test suite |
| Unit | request/response validation and unknown action rejection | schema tests |
| Integration | refresh, close, late callback, reopen | mocked extension-host API tests |
| Integration | inspect real temporary project and malformed manifest | isolated filesystem tests |
| Integration | no unapproved write/execute from UI message | side-effect negative tests |
| Desktop | launch Code-OSS and open the QuantumATi panel | captured logs + screenshot |
| Desktop | native editor ↔ Mission Control switching | manual scripted walkthrough |
| Accessibility | keyboard only, 200% zoom, contrast, reduced motion | QA evidence |
| CI | focused tests, syntax, build relevant to changed package | GitHub Actions run |
| Release | verify code review, no unintended files, no secret leaks | draft PR gate |

Never count a mocked API integration test as desktop E2E. Never count a passing Node test as Code-OSS build proof.

## 13. Definition of done for UI v1

- Real startup demonstrated in a supported desktop environment.
- Layout and navigation match the reviewed specification at wide and compact sizes.
- No fake agent state, fake health metric, fake progress or fake verification evidence.
- Code Workspace remains accessible and functional.
- Read-only project inspection works and clearly labels partial evidence.
- Settings reflect actual permissions, not desired future autonomy.
- Keyboard, contrast, focus and zoom tests recorded.
- GitHub branch and draft PR include code, tests, logs and screenshots.
- Tests/build statuses are truthful; no merge, release or deployment without explicit approval.

## 14. Risks and mitigations

- **Fork maintenance:** limit deep upstream workbench patches; stable contracts isolate UI from editor internals.
- **False security:** call policy advisory until trusted executor exists; do not expose approval/execute actions.
- **Excessive UI complexity:** build Overview + Project Intelligence first; defer graph and simulated agents.
- **Remote filesystem confusion:** enforce local-only initial adapter; show unsupported state for remote workspaces.
- **Large build cost:** use focused GitHub Actions while UI contracts stabilize; launch full native builds only when needed and within budget.
- **Visual drift:** use token file and documented component states, not ad hoc inline styles.
- **Accessibility:** no color-only statuses, support native theme/high-contrast and focus order.
- **Stale data:** requestId, snapshotId, inspectedAt and source fingerprints track staleness.

## 15. Decisions requiring user review

The architecture recommendation is **staged hybrid**, but the final visual approval is required for:
- navigation rail expanded vs collapsed by default;
- final brand/icon treatment;
- precise screen density and composition;
- when to begin native workbench modifications after the extension UI proof.

Once this blueprint and the companion UI specification are reviewed, prepare a file-by-file execution plan. Do not commit runtime changes solely on the authority of these design documents.
