# QuantumATi Mission Control — UI/UX Specification v1.0

**Status:** Draft for product review — NOT an implemented UI
**Date:** 2026-10-31
**Product:** QuantumATi, AI-native product-first software engineering environment
**Repository:** LOrdEnRYQuE/atiq-editor-core
**Development branch:** feature/quantumati-project-control-center
**Related prototype:** extensions/quantumati-control-center/
**Design thesis:** Build software by managing product intent, evidence, permissions and execution, not by navigating files first.

## 1. Source of truth and scope

This specification reflects the user's approved direction: VSCodium/Code-OSS is the technical foundation, but QuantumATi will deeply change the interaction model. The default entry point is a Project Control Center, while a complete code editor remains available. The default autonomy mode is Adaptive Autonomy. OpenCode may be used as a model/agent runtime, never as the sole security authority.

**Verified repository baseline:** the existing local extension declares onStartupFinished and renders one read-only webview. The current module shows project manifest evidence and NOT_RUN build/test states. A separate workflow exercises isolated tests. A full desktop UI and native workbench replacement are not verified.

**Out of scope for UI v1:** 3D intelligence graphs, paid model billing, deployed autonomous agents, a complete custom Electron shell, collaborative multiuser editing, production deployment, visual no-code app builder. These are possible later phases, not v1 promises.

**External reference limitation:** The previously supplied Manus URL resolves to a document titled "ATTA Textile — Shopify Store Blueprint", not a QuantumATi UI reference, so it was excluded from the visual brief.

## 2. Users and jobs to be done

- **Builder / founder:** express a product outcome, understand progress, request changes, see proof of correctness without mastering repository internals.
- **Developer:** switch instantly between product mission and real source code, inspect diffs, logs, dependencies and tests.
- **Reviewer / operator:** approve exact consequential actions, understand risk and rollback, inspect evidence before integrating changes.

Primary jobs:
1. Open a project and understand what is observed, inferred and not verified.
2. Create a goal and review an actionable plan.
3. Inspect agent proposals and approve only bounded, exact operations.
4. Follow execution and verification as visible, honest state transitions.
5. Reach the full Code-OSS editor without losing project context.

## 3. Product UX principles

1. **Product-first, code-available:** the default landing experience is Mission Control. The code editor is always one explicit action away.
2. **Evidence, not theater:** never display guessed success, fabricated test totals, pretend running agents, or fake project health.
3. **Progressive disclosure:** show an understandable summary first; expose commands, paths, diffs and traces on demand.
4. **One action / one responsibility:** navigation, approval, execution and verification are clearly distinct.
5. **Predictable automation:** every state-changing operation shows scope, risk, authority and a durable event ID.
6. **Readable professional density:** compact yet spacious enough for deep technical work. No gratuitous neon, exaggerated glow or decorative activity animations.
7. **Desktop-first with resilient small-window behavior:** keyboard support, zoom, screen-reader semantics and adaptive layout are mandatory.

## 4. Visual identity — Precision Futuristic

Mood: engineered, quietly powerful, exact, premium. Avoid generic corporate dashboards, glass overload, low-contrast translucent text and gamer-style cyberpunk.

### 4.1 Color tokens — dark reference palette

| Token | Hex | Purpose |
|---|---|---|
| qati.bg.canvas | #0B1020 | Main background |
| qati.bg.surface | #121A2B | Cards and panels |
| qati.bg.elevated | #1B2840 | Active raised panels |
| qati.text.primary | #F4F7FC | Primary content |
| qati.text.muted | #B6C2D6 | Secondary content |
| qati.accent.intelligence | #77D6FF | Active intelligence / primary highlight |
| qati.accent.autonomy | #B9A8FF | Agents and autonomy |
| qati.status.verified | #65DDB8 | Verified success |
| qati.status.pending | #FFD27A | Approval/pending |
| qati.status.failure | #FF8C9C | Failure/blocked |

Measured contrast against #121A2B: primary 16.18:1; muted 9.66:1; cyan 10.63:1; violet 8.36:1; emerald 10.42:1; amber 12.21:1; coral 7.85:1. These numbers only cover foreground-on-surface combinations, **not** every component interaction. Interactive controls, focus rings, light theme, disabled controls and charts must be separately audited.

Semantic roles must not be encoded by color alone; use icons and text such as VERIFIED, FAILED, NOT RUN and APPROVAL REQUIRED. No green status for unverified work.

### 4.2 Typography and spacing

- Interface typography: system-native sans-serif for fast consistent startup; do not bundle proprietary fonts.
- Technical values/code: environment monospace.
- Type scale: 12 / 13 / 14 / 16 / 20 / 28 px; body baseline 14 px, 1.45–1.6 line-height.
- Spacing: 4 px unit; common rhythm 8 / 12 / 16 / 24 / 32 px.
- Navigation rail: 68 px collapsed, 224 px expanded.
- Top command bar: 56 px minimum; hit targets 40–44 px preferred.
- Right inspector: 320–380 px; bottom evidence drawer: 200–320 px when open.
- Radius: 8 px controls, 12 px cards, 16 px major surfaces. Borders 1 px and subtle shadows only where they improve layering.

### 4.3 Theme interoperability

QuantumATi tokens are semantic and map to Code-OSS theme variables where relevant. Dark is the design reference, but system light/dark and high-contrast modes are supported. Custom colors cannot override critical native editor selection, focus or terminal contrast. User-selected theme takes priority for accessibility. Do not flash the wrong theme on startup.

## 5. Information architecture

### Global shell

- **Left Navigation Spine:** Mission Control, Projects, Goals, Agents, Verification, Permissions, Activity, Settings.
- **Top Context Bar:** project identity, workspace scope, currently supported autonomy level, connection/offline status, command launcher, notification queue.
- **Central Product Canvas:** context-sensitive summary or working view.
- **Right Context Inspector:** selected requirement, file, agent proposal, approval or evidence, with source provenance.
- **Bottom Execution & Evidence Drawer:** chronological events, test output, diagnostics, affected files, error details.
- **Code Workspace:** opens native editor, preserves panels and returns to Mission Control via one dedicated command.

Important: Mission Control is not an always-on blocking splash screen. Users can open code directly or disable auto-opening later.

## 6. Screen definitions

### S01 — Mission Control / Overview (v1 primary)

Regions in priority order:
1. Project heading and read-only scan status with inspected time/source.
2. Primary intent input: "What do you want to build or improve?" — disabled or marked COMING LATER until connected to a real mission engine.
3. Truth strip: OBSERVED / INFERRED / UNKNOWN / VERIFIED facts.
4. Summary panels: Project Intelligence, Goals, Agent Runtime, Verification, Permission Queue, Recent Activity.
5. "Suggested next action" only if backed by a real diagnostic or an explicit rule; otherwise "No recommendation available."
6. Quick launch to Code Workspace and project files.

Current prototype supports only observed package manifest information and NOT_RUN checks. Unavailable panels show **NOT CONNECTED** rather than synthetic numbers.

### S02 — Project Intelligence

Displays detected project name, workspace roots, supported manifests, languages inferred from evidence, possible scripts and dependency indicators. Each claim has source and "last observed" metadata. Manual Refresh re-reads allowed sources. Invalid or inaccessible manifests yield PARTIAL or UNKNOWN, never success.

A module graph is deferred. Instead use a grouped list with filter, provenance and path controls. Do not treat untrusted repository text as executable instructions.

### S03 — Goals & Missions

In v1 this is a designed, mostly non-operational view: intent, scope, acceptance criteria, proposed phases, execution policy and evidence requirements. Action buttons must be disabled or clearly gated until real orchestration exists. Later, every goal becomes a typed, persisted record; progression is PLANNED → APPROVED → RUNNING → VERIFYING → VERIFIED / FAILED / BLOCKED, with exact event evidence.

### S04 — Agents & Model Connections

Connection status per provider/engine: NOT CONFIGURED, CONNECTING, CONNECTED, DEGRADED, OFFLINE. No fabricated token quotas or agent activity. Clearly differentiate a configured model from a verified live model request. Selection UI must display cost/privacy implications before invoking external providers.

### S05 — Verification Center

Shows build/test execution status: NOT_RUN, RUNNING, PASSED, FAILED, STALE, BLOCKED. A PASSED test must link to command, runner, timestamps, exit code, workspace/commit fingerprint and log. A code change invalidates affected prior evidence; untested features cannot display VERIFIED. Unknown status cannot be silently coerced to success.

### S06 — Permissions & Approval Queue

Show requested action, tool identity, affected scope, file/diff or endpoint, impact, risk tier, reversibility, required capability, requester, expiration and approval fingerprint. Choices: DENY or APPROVE ONCE (not implemented until trusted executor exists). No "Always allow" in v1. User denial is final for that proposal; updated changes need fresh authorization. The UI never directly bypasses the permission kernel.

### S07 — Activity / Execution Timeline

Chronological, append-only mission events with precise event type and status. Filters for errors, approvals, verification and execution. Source timestamps are displayed with timezone and relative cues. No ticker, fake live heartbeat or progress bars without measured state.

### S08 — Settings and Safety

Display actual effective autonomy cap (initially READ-ONLY / L1 if the isolation and trusted executor are unavailable), configurable appearance, opt-in diagnostics, workspace trust, data retention and provider connectivity. Distinguish **desired mode: Adaptive Autonomy** from **enforced capability available in current build**.

## 7. Critical user flows

### F1 — Open project / discover

Open Code-OSS → activate local QuantumATi extension if supported → identify workspace or display an empty state → inspect allowlisted sources → render Overview → optionally open Project Intelligence → select evidence → inspect source. No worktree modifications.

### F2 — Navigate to code and return

Mission Control → select file or "Open Code Workspace" → native editor focused → return via left rail/command. Preserve the inspected project context. Context loss or automatic re-scan during mere navigation must not rewrite state.

### F3 — Propose a high-impact action (future-ready)

Agent proposes typed operation → deterministic policy evaluates → if restricted, require exact approval → UI displays diff + scope + expiration → approve once or deny → kernel re-checks current state → authorized executor runs → verifier records observed outcome. An approved proposal that is now stale returns STALE_APPROVAL.

### F4 — Handle failure or unavailable data

Manifest malformed / provider disconnected / test execution unavailable → actionable diagnostic + explicit unknown/failure state → offer retry where safe → preserve previously observed evidence with "stale" labeling. Never show green because an API request returned without a reported error.

## 8. Empty, loading, failure and permission states

| Situation | User-visible wording | Available action |
|---|---|---|
| No workspace | "Open a project to inspect its structure." | Open Folder |
| Read-only inspection running | "Inspecting allowed project files…" | Cancel only if supported |
| Manifest missing | "No supported project manifest found." | Browse files |
| Unsupported/invalid manifest | "Inspection incomplete. See details." | Inspect error |
| Build/test unavailable | "Not run" | No fake run button |
| Agent not wired | "Agent engine not connected" | View planned integration |
| Permission rejected | "Blocked by workspace policy" | Inspect why |
| Stale approval | "This approval is no longer valid" | Review updated diff |
| Offline model provider | "Provider unavailable" | Retry connection |

No status icon or copy claims a completed operation before verified evidence arrives.

## 9. Interaction specification

- Navigation is keyboard-first: Ctrl/Cmd+K launches contextual command launcher; keyboard focus order follows visual flow; Esc closes transient overlays only, not durable execution logs.
- Tabs implement proper roving focus or native semantics; dialogs trap focus, restore prior focus on close and expose explicit accessible names.
- Mouse hover reveals detail but is never the sole access method. All actions have visible focus styles.
- Context inspector updates on explicit selection and uses accessible announcements for changed evidence, avoiding over-announcement of frequent events.
- Command shortcuts must not shadow essential Code-OSS shortcuts; remapping stays user-configurable.
- Motion: 120–180 ms transitions where useful, no animation for failed/verified transitions beyond short affordances; honor reduced-motion settings.
- Refresh must be idempotent and not multiply listeners or resurrect a disposed webview.
- High-risk buttons are not grouped next to benign refresh actions and never use ambiguous names such as "Continue".

## 10. Responsive behavior and accessibility

- Wide desktop ≥1280 px: left rail, canvas, optional inspector, optional evidence drawer.
- Compact 900–1279 px: rail collapsed; inspector overlays on demand.
- Narrow <900 px: one-column canvas, nav in accessible switcher, inspector/drawer as focus-managed dialogs.
- Zoom: support 200% without clipping critical actions; content reflow target 320 CSS px where applicable.
- WCAG 2.2 AA target: text contrast ≥4.5:1 normal and ≥3:1 large; non-text controls and focus indications meet required contrast; keyboard interaction, name/role/value and target-size exceptions reviewed.
- Screen reader: landmarks (nav, main, complementary), h1–h3 hierarchy, data tables with headers, announced errors, no color-only meaning.
- Language: English is initial product UI locale; architecture supports i18n including Romanian and German. No hard-coded text inside rendering logic after UI v1 component refactor.

## 11. Component inventory and required states

- AppShell, NavigationRail, ProjectPicker, AutonomyIndicator, ConnectionStatus, CommandLauncher
- ProjectHeader, EvidenceStrip, MetricCard, StatusPill, EmptyState, ErrorPanel, SkeletonBlock
- IntentComposer, GoalSummary, AgentConnectionCard, VerificationRunCard, PermissionReviewCard
- ContextInspector, EventTimeline, EvidenceDrawer, PrimaryAction, TabBar, ToastRegion, ConfirmationDialog

Every component has loading/empty/ready/error where applicable. StatusPill supports NOT_RUN, NOT_CONNECTED and STALE as first-class values. MetricCard can render "—" with explanatory text; it must never substitute 100% or zero for absent data.

## 12. Privacy, security and trust in the UI

- No secrets in project summaries, agent logs, event previews, analytics or support exports.
- Render all repository-derived content as untrusted text; escape HTML and validate message schemas.
- The webview does not authorize or execute privileged operations. It submits typed intents to an extension controller; a later trusted kernel must revalidate every action.
- Use restrictive CSP and nonce-bound scripts, resource URIs for assets, no remote JS or CDN dependency.
- Show "READ ONLY" prominently until real isolation and permission enforcement are demonstrated.
- AI suggestions and model output are untrusted inputs; never treat an instruction embedded in a repository as user authorization.
- Event history shows when evidence is stale or the data source is offline.

## 13. UI v1 acceptance criteria

**AC-01** Mission Control opens through its registered Code-OSS command in a desktop runtime.
**AC-02** First-run workspace and no-workspace states work; no invented project data.
**AC-03** Overview and Project Intelligence show factual package.json inspection, with source and timestamps.
**AC-04** Navigation to native code and back works without losing the selected project.
**AC-05** Disposed-webview refresh events never mutate a new panel or throw.
**AC-06** All unconnected sections explicitly display NOT CONNECTED/NOT RUN and have no active fake action buttons.
**AC-07** Keyboard-only interaction covers nav, cards, inspector, close, refresh and code switch.
**AC-08** Dark/light/high-contrast modes respect editor themes; contrast audit documented.
**AC-09** Zoom at 200%, compact width and reduced motion do not hide essential controls.
**AC-10** Untrusted project strings cannot inject HTML/script into the dashboard.
**AC-11** No API/network calls, writes or model requests are triggered by read-only navigation.
**AC-12** Evidence and approval UI never claim enforcement that does not exist.
**AC-13** Focused tests, extension-host integration and a real desktop walkthrough are recorded separately.
**AC-14** Release requires updated docs and sign-off; no silent merge or automatic production publish.

## 14. Design validation and sign-off

- Review a low- and high-density project view with real sample data (no fake operations).
- Run a five-task usability walkthrough: inspect project, open code, find failed test, review blocked operation, return to mission.
- Measure time-to-first-understanding, correct recognition of UNKNOWN vs VERIFIED, navigation success, and approval comprehension.
- Capture at least two desktop window widths, keyboard focus paths, and light/dark screenshots.
- Conduct threat review for prompt-injection-looking repository text and stale approval preview.
- This document is a **design proposal**, not proof of an implemented interface. Implementation follows only after reviewing this specification.

## 15. Decisions and future iterations

**UI v1** is an honest product-first design applied incrementally through the existing Code-OSS extension; native workbench integration follows after desktop E2E and build reliability. **UI v2** may add deeper workbench service integration and persisted project mission state. **UI v3** may add dependency graphs, true agent orchestration and visual building once corresponding engines are proven.

Open questions before final visual sign-off: exact icon/logo artwork, whether default rail is expanded, and branded custom fonts (current design avoids font bundling). These are non-blocking and can be resolved in the visual QA phase without weakening the safety contracts.
