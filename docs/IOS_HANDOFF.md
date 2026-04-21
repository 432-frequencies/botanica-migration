# iOS Handoff

This document is the short path for an iOS developer taking W1LD to TestFlight.

## App Identity

- App name: `W1LD`
- Bundle ID: `com.w1ld.botanica`
- iOS project: `ios/App/App.xcodeproj`
- Web bundle source: `dist`
- Capacitor copy target: `ios/App/App/public`
- Minimum iOS target: iOS 15

## Release Build Flow

```bash
npm install
npm run build
npm run ios:sync
npm run ios:open
```

Then in Xcode:
1. Select the `App` scheme.
2. Select the Apple Developer Team in Signing & Capabilities.
3. Product > Clean Build Folder.
4. Build on a simulator or connected iPhone.
5. Product > Archive.
6. Distribute App > App Store Connect > TestFlight.

## Required Native Permissions

Already present in `ios/App/App/Info.plist`:
- Camera
- Photo Library
- Location When In Use

Not currently wired natively:
- Contacts. The current social flow uses web/browser capabilities. If true iOS contact import becomes release-critical, add a Capacitor contacts plugin and `NSContactsUsageDescription`.

## RevenueCat / Purchases

The RevenueCat packages are installed through Capacitor Swift Package Manager integration.

Before testing subscriptions in TestFlight, confirm:
- App Store Connect products exist.
- RevenueCat project is linked to the Apple app.
- Entitlement ID matches the backend env.
- Vercel env includes the RevenueCat secret values.
- Client env includes the iOS public RevenueCat key.

If subscription testing is not part of the first TestFlight, the core app can still be tested without this being fully complete.

## Supabase Release Checks

Confirm these migrations are applied in the production Supabase project:
- `supabase/migrations/20260416_observation_context.sql`
- `supabase/migrations/20260417_edibility_status.sql`
- `supabase/migrations/20260417_arachnid_category.sql`
- `supabase/release/20260417_ios_testflight_readiness.sql`

The app is designed to degrade safely when older rows do not yet have these fields, but the best TestFlight signal requires the production DB to be current.

## Cache Gotchas

If the iOS app appears stale:
1. Run `npm run build`.
2. Run `npm run ios:sync`.
3. Check `ios/App/App/public/index.html`.
4. In Xcode, use Product > Clean Build Folder.
5. Delete the app from the simulator/device before reinstalling if needed.

Do not judge a TestFlight candidate from an old `build/DerivedData` artifact.

## Senior iOS Review Focus

Priority review areas:
- Signing and provisioning profile setup.
- App Store Connect product and entitlement consistency.
- Camera permission copy and first-scan flow.
- Location permission copy and fallback behavior.
- WebView safe-area behavior on small iPhones.
- Offline/poor-network behavior during scan and save.
- Crash-free launch after cold install.
