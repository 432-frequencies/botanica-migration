# Supabase database files

This folder keeps database work separated by intent so release preparation stays predictable.

## Structure

- `schema/` contains reference snapshots. Use these to understand the expected shape of the database, not as blind production patches.
- `migrations/` contains idempotent SQL migrations that can be applied in filename order.
- `manual-patches/` contains historical one-off Dashboard fixes. Do not rerun them unless you are investigating that exact issue.
- `diagnostics/` contains read-only or investigative SQL helpers.

## Release-critical migrations

Before the iOS/TestFlight build, apply these migrations in Supabase SQL Editor or through a Postgres connection:

1. `supabase/migrations/20260416_observation_context.sql`
2. `supabase/migrations/20260417_edibility_status.sql`
3. `supabase/migrations/20260417_arachnid_category.sql`

Both scripts are idempotent and safe to rerun. They add:

- `plant_discoveries.observation_context`
- `plant_discoveries.edibility_status`
- `plant_discoveries.safety_notes`
- `plant_discoveries.category = 'arachnid'`

If you want one pasteable release script instead, use:

- `supabase/release/20260417_ios_testflight_readiness.sql`

After applying it, run:

- `supabase/diagnostics/check_release_readiness.sql`

## Why these fields matter

- `observation_context` protects the scientific quality of local observations by distinguishing field observations from domestic/off-context scans.
- `edibility_status` avoids unsafe boolean-only assumptions for edible/toxic species.
- `safety_notes` lets the UI show a clear caution message for plants, trees, and fungi.
