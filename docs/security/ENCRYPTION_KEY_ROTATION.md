# Encryption Key Rotation Policy

## Goal
Rotate `DATA_ENCRYPTION_KEY` without breaking decrypt, login lookups, or password recovery.

## Supported mechanism
- Active key: `DATA_ENCRYPTION_KEY`
- Legacy keys: `DATA_ENCRYPTION_OLD_KEYS` (comma-separated)
- Backend decrypt and blind-index lookup support key variants.

## Rotation procedure
1. Add current active key to `DATA_ENCRYPTION_OLD_KEYS`.
2. Set new `DATA_ENCRYPTION_KEY`.
3. Deploy backend.
4. Run:
   - `npm run migrate:encrypt`
   - `npm run verify:encryption`
5. After successful migration and no mismatches, remove stale legacy keys.

## Safety checks
- Never rotate key and code simultaneously without staging validation.
- Keep at least one rollback key in `DATA_ENCRYPTION_OLD_KEYS` until verification passes.
- Do not expose keys in logs, screenshots, or commit history.
