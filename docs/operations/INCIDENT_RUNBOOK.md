# Incident Response Runbook

## Severity levels
- `SEV-1`: Full outage, authentication broken for all users, or data corruption.
- `SEV-2`: Core module degraded (chat/events/admin) with partial impact.
- `SEV-3`: Non-critical issue with workaround available.

## Immediate actions
1. Acknowledge incident and record start timestamp.
2. Check `/api/health` and `/api/ready`.
3. Inspect latest backend logs by `requestId`.
4. If auth outage: verify `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, and encryption key vars.

## Containment
1. Pause risky admin mutations if data inconsistency is suspected.
2. Roll back to last known good deploy if new release caused regression.
3. Run dry-run data checks:
   - `npm run migrate:encrypt:dry-run`
   - `npm run verify:encryption`

## Resolution validation
1. Login success for approved user.
2. Reset-password flow success.
3. Admin can access user directory and event/project pages.
4. Recruitment application create/update path works.

## Post-incident
1. Publish RCA with timeline and root cause.
2. Add regression tests and CI gate if missing.
3. Update this runbook for newly discovered failure mode.
