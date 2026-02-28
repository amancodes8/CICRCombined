# Backup and Restore Runbook

## Backup strategy
- Use MongoDB Atlas continuous backups (recommended).
- Keep daily logical backups for critical collections:
  - `users`
  - `projects`
  - `events`
  - `communicationmessages`
  - `applications`
  - `issuetickets`

## Manual backup command
```bash
mongodump --uri "$MONGO_URI" --out ./backups/$(date +%F)
```

## Restore command
```bash
mongorestore --uri "$MONGO_URI" --drop ./backups/<backup-date>/
```

## Restore drill cadence
- Weekly: restore to staging and run smoke checks.
- Monthly: full restore simulation + admin login + chat + recruitment flow verification.

## Post-restore checks
- `GET /api/health` returns `success: true`.
- `npm run verify:encryption` returns no mismatches.
- Admin can view users, events, projects, and applications.
