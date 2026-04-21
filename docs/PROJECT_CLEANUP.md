# Project Cleanup Notes

## What Is Release-Critical

Keep these areas easy to inspect:
- `src/` for the React app
- `api/` for Vercel serverless functions
- `supabase/` for database state
- `ios/App/` for the Capacitor iOS wrapper
- `public/` for source assets
- `docs/` for release handoff notes

## What Is Historical

The root currently contains old zip archives and dated project snapshots. They are useful as recovery points, but they should not be part of day-to-day review or deployment.

Ignored from Git/Vercel:
- `*.zip`
- `botanica-migration-*-current-state*/`
- `botanica-migration-*-current-state-clean*/`
- `botanica-quest-go*.zip`
- `build/`
- `dist/`
- `W1LD/`

## Suggested Next Cleanup

When the current TestFlight candidate is validated, move historical archives outside the repository into a single external folder, for example:

```text
/Users/sam/Desktop/W1LD/Archives/
```

Do this only after the TestFlight build is confirmed, so the release workspace remains safe during the last-mile push.

## Deployment Hygiene

Vercel should deploy only the web app and API functions. It should not upload:
- iOS build output
- DerivedData
- old archives
- dated repository snapshots
- local env files

The `.vercelignore` file enforces this.
