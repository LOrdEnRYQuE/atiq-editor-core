# QuantumATi Durable Missions v1 — read-only recovery slice

Date: 2026-11-01  
Branch: `feature/quantumati-durable-missions-v1`  
Baseline: `feature/quantumati-mission-approval-broker-v1`  
Scope: **local, file-based, read-only worker + durable event ledger**  
No app installation, paid APIs, Mac access, production changes or merge to `main`.

## Customer problem

Repeated "Accept all" dialogs, "Continue" prompts and failed AI attempts turn the customer into a project babysitter. Intended product outcome: user approves a well-scoped mission once, authorized low-risk work continues without repetitive prompts, and progress persists across interruptions.

**What is actually implemented today:** a Node.js library that runs *read-only file-fingerprint tasks*, checks a bounded mission contract, persists receipts, and can resume after a process restart. This is not yet a GUI, approved autonomous coding agent, trusted user-authenticated permission broker, remote worker or Code-OSS desktop integration.

## Files

- `extensions/quantumati-control-center/mission-recovery.cjs` — persistent mission ledger and read-only task worker
- `extensions/quantumati-control-center/test/mission-recovery.test.cjs` — end-to-end filesystem tests
- `extensions/quantumati-control-center/mission-approval-policy.cjs` — existing advisory action eligibility policy
- `.github/workflows/quantumati-durable-missions.yml` — isolated CI check for all extension tests

## What can be demonstrated

1. A trusted local host calls `createMission({storeDir,manifest,nowMs})` with an explicit, constrained read-only task list.
2. `runMission({storeDir,missionId,nowMs,limit})` claims and fingerprints eligible files (never returns source contents).
3. Each task claim and outcome is recorded as a numbered, append-only event. Data and directories are written with private permissions. Event contents are fsynced, new sequence files are published using atomic hard-links and directories are fsynced where supported.
4. `inspectMission({storeDir,missionId})` replays history and reports actual status, usage and immutable receipts.
5. A new Node process can continue remaining queued tasks without rerunning completed work.
6. Two read-only workers can concurrently claim tasks without double-counting completed receipts; claimed work can be retried after a lease expires, within the original budget.
7. Changed sources, secret paths, symlinks, expired grants, exhausted budgets and damaged history block or pause; they cannot produce false `COMPLETED` receipts.

### Accepted scope

- Only file hashing within the declared workspace. No arbitrary shell commands, AI prompts, code edits, deletes, deployment, network, payments or package installation.
- Each task requires the original file SHA-256, and the worker checks it before recording a result.
- `maxCostCents` is fixed to **zero**. There is no external LLM/tool access.
- Mission IDs are unique; an existing mission cannot be silently replaced with a broader grant.
- The worker tracks no interactive prompts because it has no UI; `approvalPrompts: 0` is **not** evidence of reduced user interaction in the desktop product.
- The mission grant is created by an API caller, **not** by a cryptographically verified human approval workflow.

### Limitations and risks

- The hash chain identifies accidental corruption and unsophisticated tampering. **It is not authenticated or tamper-proof**: someone with write access to the store could rewrite events and hashes. Do not use a persisted grant as a security authority for modifying code.
- The `isolatedWorkspace` policy flag does not establish OS process isolation; the worker's authority is deliberately restricted to read-only inspection.
- File path validation and no-follow checks reduce risk but are not a complete defense against hostile filesystem races. Protect source checkout and vault via OS security.
- Tests cover process restart, a simulated post-claim crash, concurrent Node workers and denial cases on Linux. They do not prove power-loss durability, malicious storage owners, Windows/macOS filesystem behavior or real application lifecycle.
- The worker does not start itself in the background, schedule reminders, persist model conversation state, or keep running when the computer is off.

## Run

From repository root:

    node --test extensions/quantumati-control-center/test/*.test.cjs

Programmatic API usage (from an authorized host in the future):

    const { createMission, runMission, inspectMission } = require('./extensions/quantumati-control-center/mission-recovery.cjs');

For a real mission, the host must supply a private `storeDir`, its own authenticated approval decision and a manifest of file paths and expected SHA-256 values. The module **must not** be exposed directly to an AI as a privileged tool with writable grant inputs.

## Next gates before customers can stop supervising

1. Trusted user approval, stored outside agent-controlled inputs; revoke/extend grants and bind each approval to exact mission, workspace, user, branch, cost and expiry.
2. Independent worker process with OS sandboxing, effective network and filesystem limits and enforced policy. Run in a background service only when expressly configured.
3. SafeChange atomic file updates, verified before/after snapshots, rollback and crash recovery. Do not promote the present read-only worker to edit rights.
4. Mission scheduler, durable checkpoints, action-specific approval queue and grouped user notifications.
5. Code-OSS desktop UI, genuine extension activation and uninterrupted end-to-end test with closed/reopened application.

### Release gate

`releaseReady: false` is returned by the library. The read-only slice can have passing tests while the autonomous IDE remains unverified.

**Customer promise:** Approve the mission, not every action — with safeguards enforced by software, not by model-generated assurances.
