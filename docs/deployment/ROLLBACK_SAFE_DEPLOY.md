# Rollback-safe Deployment Procedure

## Pre-deploy
1. CI must pass (`backend + frontend` jobs).
2. Run backend checks on target branch:
   - `npm run lint`
   - `npm run test`
   - `npm run check:migrations`
3. Confirm env vars:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `DATA_ENCRYPTION_KEY`
   - optional `DATA_ENCRYPTION_OLD_KEYS`

## Deploy order
1. Deploy backend first.
2. Verify:
   - `/api/health`
   - `/api/ready`
3. Run data checks:
   - `npm run migrate:encrypt:dry-run`
   - `npm run verify:encryption`
4. Deploy frontend.

## Rollback criteria
- Login error rate spike.
- Reset-password flow failure.
- `/api/ready` not healthy for 5+ minutes.

## Rollback steps
1. Revert backend to last successful commit.
2. Restore previous env set (including encryption key values).
3. Recheck `/api/ready`.
4. Roll back frontend if API contract changed.
