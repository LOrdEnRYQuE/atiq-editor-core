# QuantumATi customer-paid model gateway — isolated prototype

This slice proves the customer can purchase access from QuantumATi without needing an upstream provider API key.

## Implemented

- Server-side tenant identity callback (injected, without a configured auth provider).
- FREE and PREMIUM catalog; unknown pricing is explicitly NOT_CONFIGURED.
- Premium usage denied unless trusted backend purchase verifier accepted entitlement.
- Idempotent verified payment events and refund/chargeback revocation.
- Tenant-scoped prepaid quota units, in-process reservations and settlement, request idempotency and sanitized provider errors.
- Injected demo models/providers and HTTP tests use no external network or billable provider.
- GET /v1/models, GET /v1/account and POST /v1/chat. No public credit grant endpoint.

Run: node --test services/quantumati-ai-gateway/test/*.test.cjs

## Important: NOT production ready

All entitlement state is IN MEMORY, is lost at restart, and is not safe across process replicas. This is a reference/contract test, NOT a payment service. Authentication is injected, with test-only demo tokens. verifyPayment is a callback contract, not an actual payment-processor implementation. Quota units are not money or estimated euros. There are no real payment gateways, provider API accounts, subscription prices, pricing agreements, signed webhooks or client-ready checkout.

Before real customers: durable ACID ledger, transaction serialization, gateway authentication, processor webhook signature/replay validation, reconciliation, per-tenant rate limits, provider usage verification, bounded timeouts, crash safety, refunds for in-flight requests, secrets management, audited commerce/terms, regulatory/tax requirements, real desktop and web E2E, and provider resale/embedded-service rights.

The desktop IDE remains VSCodium-based; OpenCode is optional, not required. Never enable real charges based on this prototype.