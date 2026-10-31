# QuantumATi — Mission Approval Broker v1

Status: **Policy prototype only**. Not connected to an agent, privileged executor, persistent approval store, or live UI. No automated approvals or file edits are active.

## User outcome

A client authorizes a bounded mission once and can leave the desktop. The system performs permitted low-risk steps without repeated Accept All prompts. It pauses and batches the few decisions that genuinely require human consent. This is the **future user path**, not a current runtime claim.

## Why not use unconditional Accept All?

Global auto-approval, including VS Code Allow all / Autopilot, can also approve risky or destructive actions. It is useful only when OS-enforced isolation and other controls are appropriate. Our intended difference is a **mission-scoped authorization**, checked by code rather than accepted on the basis of an LLM's advice.

Documentation: https://code.visualstudio.com/docs/agents/run/approvals and https://code.visualstudio.com/docs/agents/run/security.

## Mission Authorization Contract (target)

A user-approved contract must be created and persisted by a trusted host, not by an AI model. Required immutable fields:
- Mission ID and user/tenant identity; approval event ID; version and signature or trusted durable reference.
- Workspace and isolated worktree identifiers plus an exact branch/initial revision.
- Allowed action types, approved test identifiers, affected paths and external-domain allowlists.
- Deadline, maximum approved steps, failure/retry budget, money/token budget, resource budget.
- Scope changes, privilege escalation, deployment and payment always require separate action-specific approvals.
- Pause/stop control and restart semantics; audit log and checkpoints with verification.

**Security constraints for real enforcement:** A privileged broker MUST load grants from its own authenticated store, verify an action request and compare the current file version immediately before its side effect. It MUST enforce all boundaries in the OS-isolated executor, not rely on a Boolean field in the model's proposed command, the webview, or a tool prompt. Counters must be durable and synchronized across workers; independent requests cannot overspend by racing. Approvals for sensitive operations should bind to an exact immutable diff/action hash and expire when inputs change. The read-only policy here does none of those things yet.

## First policy prototype (implemented)

Module: extensions/quantumati-control-center/mission-approval-policy.cjs.

It inspects a proposed action and a supplied grant/context, and returns a decision:
- AUTO_ELIGIBLE — a scoped read, edit with matching source hash, or named allowlisted test.
- PAUSE — expired grant, exhausted action/error/cost allowance, or stale source content.
- REQUIRE_APPROVAL — publish, deploy, delete, git push, install, network or payment operations.
- DENY — outside workspace, sensitive paths, symlinks, arbitrary shell, unknown actions or missing mission scope.

Every result has **enforced:false**. This module does not execute a command, write files, approve costs, grant access, persist a state or provide a security boundary. A test that returns AUTO_ELIGIBLE is *not* permission to bypass an external agent platform's confirmation.

Run the tests from the repository root:

    node --test extensions/quantumati-control-center/test/*.test.cjs

## Orchestration and UI (not implemented)

1. User reviews a plain-language mission plan and approves once.
2. Trusted Mission Broker creates a narrow grant, records a checkpoint and dispatches permitted jobs.
3. SafeChange compares current source hash and original revision; executable enforcement must be atomic with the edit to avoid TOCTOU races.
4. Verifier checks test/build outcomes; TruthGuard never treats agent-written text as proof.
5. When blocked, scheduler continues unrelated safe jobs, groups approval requests and sends one concise explanation instead of repeated popups.
6. Reboot or closed laptop does not mean the app works in the background. That requires a running worker (local machine or expressly authorized server) and durable state.

## Required pre-release verification gates

- Test permission tampering, stale approvals, symlinks, path traversal, shell obfuscation and prompt injection.
- Test over-budget concurrent workers, grant expiration during execution, cancellation and restoration after crash.
- Test exact diff binding and non-overwritable snapshots before any automated write.
- Test resource/compute limits plus networking restrictions at OS/runtime boundary.
- Verify the actual end-to-end desktop path with a real agent, real user approval and a working isolated executor.
- Track **human approval prompts per completed mission** and **verified completions per user-attention minute**.

Budget for current work: **0 EUR incremental**. Production operations, subscriptions, external accounts, deployments and purchases are out of scope.

Customer promise: **Approve the mission, not every keystroke.** Never turn Accept All into an unsafe global default.
