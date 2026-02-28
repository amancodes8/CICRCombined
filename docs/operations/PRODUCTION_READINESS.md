# Production Readiness Checklist

## Quality gates
- CI pipeline: `.github/workflows/ci.yml` runs backend lint, tests, migration checks, and prod dependency audit.
- Frontend gate: lint + build + prod dependency audit.
- Node runtime pinning: root `.nvmrc` and `engines` in backend/frontend package files.

## Security controls
- JWT claims hardened with `issuer` + `audience` validation.
- Auth lockout policy enabled:
  - `AUTH_MAX_FAILED_ATTEMPTS` (default `6`)
  - `AUTH_LOCK_MINUTES` (default `20`)
- Request security headers enforced in `middleware/securityMiddleware.js`.
- Request tracing with `X-Request-Id` and structured JSON logging.
- Field-level encryption + blind-index hashing for sensitive fields.

## Ops and observability
- `/api/health` for liveness with uptime and DB state.
- `/api/ready` for readiness (env + DB checks).
- `/api/metrics` available outside production for diagnostics.
- Structured logs from `utils/logger.js` and `requestLogger` middleware.

## Data safety
- Encryption migration:
  - `npm run migrate:encrypt:dry-run`
  - `npm run migrate:encrypt`
- Encryption verification:
  - `npm run verify:encryption`
  - `npm run verify:encryption:fix`

## Performance
- Smoke load runner:
  - `npm run perf:smoke`
  - Configure with `PERF_BASE_URL`, `PERF_CONCURRENCY`, `PERF_REQUESTS`.
