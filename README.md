# W1LD

Mobile-first React/Vite app for documenting local biodiversity, wrapped for iOS with Capacitor.

## Product Scope

W1LD lets users scan living species, save observations, explore local references, and build a territorial record of the living world around them.

Current focus:
- Home / Feed: scan entry point, local opportunity, user progress, local impact, nearby referenced species.
- Scan flow: camera capture, AI identification, safety context, observation context, save to Supabase.
- Journal: saved discoveries and species details.
- Zones: local territory map plus atlas direction.
- Ranks / Friends / Profile: progression, social layer, and subscription surfaces.

## Stack

- Frontend: React 18, Vite, Tailwind CSS
- Hosting: Vercel
- Database/Auth/Storage: Supabase
- Native iOS wrapper: Capacitor
- AI identification: Vercel Functions + Gemini
- Purchases: RevenueCat Capacitor packages

## Key Commands

```bash
npm install
npm run dev
npm run build
npm run preview
npm run ios:sync
npm run ios:open
vercel --prod --yes --force
```

## Project Structure

```text
api/                  Vercel serverless functions
src/api/              Supabase and app data access helpers
src/components/       Shared React components
src/components/map/   Zones and atlas UI components
src/lib/              Auth, navigation, app-level utilities
src/pages/            Route-level screens
supabase/             Schema, migrations, diagnostics, release SQL
ios/App/              Capacitor iOS project used for Xcode/TestFlight
public/               Web assets copied into builds
docs/                 Release and handoff documentation
```

## Environment

Required runtime variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `PLANTID_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_ID_PRO`

Native subscription testing also needs RevenueCat/App Store configuration:
- `VITE_REVENUECAT_APPLE_API_KEY`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID`

Do not commit `.env`, `.env.local`, archives, `dist`, `build`, or Xcode DerivedData.

## iOS Release Path

The iOS project is:

```text
ios/App/App.xcodeproj
```

Before TestFlight:
1. Run `npm run build`.
2. Run `npm run ios:sync`.
3. Open `ios/App/App.xcodeproj`.
4. Select the Apple Developer Team in Signing & Capabilities.
5. Use Product > Clean Build Folder.
6. Build on simulator or a connected iPhone.
7. Archive and upload to App Store Connect / TestFlight.

See [iOS handoff](docs/IOS_HANDOFF.md) for the detailed checklist.

## Supabase

Release-critical migrations live in:

```text
supabase/migrations/
supabase/release/
```

Before a TestFlight meant for real testing, confirm at minimum:
- `20260416_observation_context.sql`
- `20260417_edibility_status.sql`
- `20260417_arachnid_category.sql`
- `20260417_ios_testflight_readiness.sql`

## Current Release Notes

- Production URL: https://botanica-migration.vercel.app
- Bundle ID: `com.w1ld.botanica`
- App name: `W1LD`
- iOS deployment target: iOS 15+
- Main branch should stay deployable at all times.
