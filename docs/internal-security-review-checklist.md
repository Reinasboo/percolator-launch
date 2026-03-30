# Internal security review checklist

This document is a **repeatable internal review** for maintainers. It is **not** a penetration test, formal audit report, or guarantee of security.

## How this differs from recent automation work

CI already enforces much of the dependency surface (for example `pnpm audit` at high severity with ignores documented in `SECURITY-DEPS.md` and root `package.json`). Targeted PRs may add tests, guards, or logging. None of that replaces a **conscious walk-through** of auth, data flows, configuration, and operations below.

## When to run

- Before a **mainnet** or otherwise high-stakes release  
- **Quarterly** during active development, or after large refactors touching auth, payments, or market lifecycle  
- Whenever **new third-party services** or **privileged** API routes are added  

Record completion in your process of choice (issue, release notes, or internal doc) with **date**, **commit SHA**, and **reviewer**.

---

## 1. Dependencies and supply chain

- [ ] `pnpm audit --audit-level=high` passes locally (only ignores that match `SECURITY-DEPS.md` / `pnpm.auditConfig`)  
- [ ] New **production** dependencies since last review skimmed for reputation, bundle size, and maintainer activity  
- [ ] `pnpm.overrides` entries still justified; no unexplained drift in lockfile  

## 2. Secrets and configuration

- [ ] No private keys, API secrets, or Supabase **service role** material in git history or tracked files (search for patterns such as `PRIVATE_KEY`, `SERVICE_ROLE`, raw `sk-` API keys)  
- [ ] Production env vars documented for deployers; rotation plan for critical secrets  
- [ ] Client bundle: `NEXT_PUBLIC_*` and any `process.env` use in client components reviewed so nothing sensitive ships to the browser  

## 3. Application API (Next.js routes and backends)

- [ ] High-abuse routes (faucet, airdrop, market creation, admin, RPC proxy): **authentication / authorization** and **rate limiting** still match product intent  
- [ ] **In-memory** rate limits: team accepts **per-instance** behavior; shared limits considered if global abuse control is required (`SECURITY-DEPS.md`)  
- [ ] Error handling: failures return safe messages; sensitive details not logged to clients  
- [ ] File uploads and external URL fetches (if any): size limits, content validation, SSRF considerations  

## 4. Data stores and privacy

- [ ] Supabase (or other DB): RLS / policies consistent with who may read or write what  
- [ ] Logs, metrics, and support exports: no unintended PII or secrets  

## 5. Infrastructure and delivery

- [ ] Required GitHub checks (unit, integration, e2e where applicable, typecheck, security job) match branch protection expectations  
- [ ] CORS, cookies, and HSTS align with actual production origins  
- [ ] Third-party dashboards (hosting, DB, RPC) access restricted and MFA’d where available  

## 6. On-chain and external integrations

- [ ] Oracle / keeper / RPC failure modes understood; UI and APIs degrade predictably  
- [ ] Program upgrades, authorities, and emergency procedures documented for operators  

---

## Sign-off

| Field        | Value |
| ------------ | ----- |
| Reviewer     |       |
| Date         |       |
| Commit / tag |       |
| Follow-ups   |       |
