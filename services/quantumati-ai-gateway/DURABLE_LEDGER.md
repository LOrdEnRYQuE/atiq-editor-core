# QuantumATi durable credits prototype (SQLite / Node 22)

This isolated slice persists **customer entitlement units, verified payment-event identifiers, premium request reservations, settled outcomes and revocations** across Node process restarts in a local SQLite database. It uses WAL and BEGIN IMMEDIATE transactions and rejects conflicting event/request replays. It does NOT initiate payments, connect to providers, or enable charges.

```
node --test services/quantumati-ai-gateway/test/*.test.cjs
```

## Contracts

- createDurableEntitlementLedger({filename, now, verifyPayment}) requires a non-memory SQLite file, an injected trusted payment verifier and a clock.
- applyVerifiedEvent(event) only accepts externally verified `payment.confirmed`, `payment.refunded`, `payment.chargeback` notifications. Test verifier simulates approval; **production signature validation is absent**.
- reserve(tenant, model, requestId, signature, units) protects quota via transactional reservations. Identical completed requests replay their recorded result without calling the upstream provider again.
- A request still `PENDING` after process restart returns REQUEST_PENDING_RECONCILIATION, retaining its reservation. It must not be automatically retried or refunded because the provider might have processed it before a crash.
- settle commits a completed usage outcome or releases the reservation after failure. Distinct tenant and model scope are checked before reservation.
- close() releases database resources, and cleanup may invoke it repeatedly.

## Explicit blockers before release

This is **not an operational payment or billing service**. SQLite's local file is not a distributed ledger and is not designed for shared multi-host server deployment. The code does not provide account authentication, signed webhooks, durable provider idempotency keys, a reconciliation worker, request cancellation, privacy audit, metrics, backups, tenant-level rate limits, real plan prices, taxes, guaranteed final upstream usage, production migrations or actual subscription payments. Node's SQLite API is experimental in Node 22. Payment unit counts are internal quota, **not currency**.

Do not deploy against real clients, charge customers or use production provider credentials. Move to an ACID database suited for a server fleet and design a reconciliation state machine before paid production use. Keep desktop VSCodium integration independent of the gateway.
