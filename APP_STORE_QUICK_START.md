# 🚀 App Store Launch - Quick Start Guide

**Status**: Web app LIVE ✅ | iOS app TODO ⏳
**Estimated Time to Launch**: 2-3 days

---

## 📋 The Essentials (TL;DR)

### What's Done ✅
- Web app deployed: https://botanica-migration.vercel.app
- Animations 60fps working
- All features tested & functional
- Build production ready (276KB gzipped)

### What's Missing ⏳
1. **Apple Developer Account** (99€/year)
2. **iOS build** (Capacitor + Xcode)
3. **App Store assets** (screenshots, icon)
4. **Legal pages** (Privacy Policy, Terms)

---

## 🎯 3-Day Launch Plan

### Day 1: Setup
**Morning** (2h)
- [ ] Register Apple Developer (https://developer.apple.com) - 99€
- [ ] Install Capacitor iOS
  ```bash
  npm install @capacitor/ios
  npx cap add ios
  npx cap sync ios
  npx cap open ios
  ```

**Afternoon** (4h)
- [ ] Create app icon 1024×1024 (Figma/hire designer)
- [ ] Write Privacy Policy page
- [ ] Configure Xcode project (signing, bundle ID)

---

### Day 2: Build & Test
**Morning** (3h)
- [ ] Build iOS app in Xcode (Product → Archive)
- [ ] Test on real iPhone (borrow or TestFlight)
- [ ] Fix any iOS-specific bugs

**Afternoon** (3h)
- [ ] Take screenshots on device (5-10 per size)
- [ ] Create App Store Connect record
- [ ] Fill app metadata (description, keywords)

---

### Day 3: Submit
**Morning** (2h)
- [ ] Upload build to App Store Connect
- [ ] Add screenshots + metadata
- [ ] Create demo account for reviewers
- [ ] Submit for review ✅

**Wait 24-48h** → Apple review → Approved 🎉

---

## 💰 Costs

| Item | Cost | Required |
|------|------|----------|
| Apple Developer Program | 99€/year | ✅ Yes |
| App Icon Design | 50-200€ | Optional (can DIY) |
| Hosting (Vercel) | 0€ | ✅ Already done |
| Domain (optional) | 10€/year | No |
| **Total** | **~100-300€** | - |

---

## 📱 Minimum Requirements

### Technical
- macOS computer (for Xcode)
- Xcode 15+ installed (free)
- iPhone for testing (borrow OK)
- Apple Developer account (99€)

### Assets
- App icon 1024×1024 PNG
- 5-10 screenshots per device size
- Privacy Policy URL
- Support email

### Legal
- Privacy Policy (template fourni)
- Terms of Service (optionnel)
- Age 13+ compliance

---

## 🎨 Assets Needed

### App Icon (1024×1024)
**Quick options**:
1. **Hire designer** (Fiverr: 20-50€, 24h delivery)
2. **DIY Figma** (use current logo + polish)
3. **AI generator** (Midjourney/DALL-E + cleanup)

**Requirements**:
- No transparency
- No rounded corners (Apple adds them)
- PNG format, sRGB color space

---

### Screenshots (Critical Sizes)
**iPhone 6.7"** (Pro Max) - 1290 × 2796 px
- [ ] Home screen (scanner visible)
- [ ] Scan result modal
- [ ] Collection grid
- [ ] Plant detail modal
- [ ] Territorial map

**iPhone 6.1"** (Standard) - 1179 × 2556 px
- [ ] Same 5 screens

**How to capture**:
```bash
# Use Xcode Simulator
xcrun simctl io booted screenshot screenshot.png

# Or use real device → Screenshot → AirDrop to Mac
```

---

## 📝 Privacy Policy Template

Create file: `/public/privacy.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>Privacy Policy - W1LD Botanica</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px;">
  <h1>Privacy Policy</h1>
  <p><strong>Effective Date:</strong> [DATE]</p>

  <h2>Data We Collect</h2>
  <ul>
    <li>Email address (for authentication)</li>
    <li>Plant photos (stored on Supabase)</li>
    <li>GPS location (for territorial zones)</li>
    <li>Usage statistics (anonymous)</li>
  </ul>

  <h2>How We Use Data</h2>
  <ul>
    <li>Authentication & account management</li>
    <li>Store your plant discoveries</li>
    <li>Territorial map features</li>
    <li>Improve app experience</li>
  </ul>

  <h2>Data Sharing</h2>
  <p>We do NOT sell your data to third parties.</p>
  <p>Photos are stored on Supabase (GDPR compliant).</p>

  <h2>Your Rights</h2>
  <p>You can request data deletion by emailing: support@w1ld.app</p>

  <h2>Contact</h2>
  <p>Email: support@w1ld.app</p>
  <p>Website: https://botanica-migration.vercel.app</p>
</body>
</html>
```

**URL**: https://botanica-migration.vercel.app/privacy.html

---

## 🔑 Demo Account for Apple Review

Create a test account in Supabase:

**Email**: `review@w1ld.app`
**Password**: `TestReview2024!`

Pre-populate with:
- 5-10 plant discoveries
- Level 3-5
- Some achievements unlocked

**Review notes**:
```
Test Account:
Email: review@w1ld.app
Password: TestReview2024!

How to test:
1. Login → Home → Tap "Scanner"
2. Allow camera permissions
3. Take photo of any plant
4. See AI identification
5. Save to collection
6. Check "Journal" tab

Camera permission required for core feature.
```

---

## ⚠️ Common Rejection Reasons (Avoid These!)

1. **App crashes** → Test exhaustively before submit
2. **Missing privacy policy** → Create page NOW
3. **Demo account doesn't work** → Test it yourself
4. **Screenshots don't match app** → Use real captures
5. **Permissions not justified** → Add descriptions in Info.plist

---

## 📊 Capacitor Setup (Step-by-Step)

```bash
# 1. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios

# 2. Initialize
npx cap init
# App name: W1LD Botanica
# App ID: com.w1ld.botanica
# Web dir: dist

# 3. Add iOS platform
npx cap add ios

# 4. Build web assets
npm run build

# 5. Copy to iOS
npx cap sync ios

# 6. Open Xcode
npx cap open ios
```

**In Xcode**:
1. Select team (Apple Developer account)
2. Set Bundle ID: `com.w1ld.botanica`
3. Set version: `1.0.0`
4. Product → Archive
5. Distribute → App Store Connect

---

## 🎯 Success Metrics

### Week 1
- [ ] 100+ downloads
- [ ] < 3 crashes reported
- [ ] 4+ star rating average
- [ ] 0 critical bugs

### Month 1
- [ ] 1000+ downloads
- [ ] 50+ active users
- [ ] Featured by Apple (aspiration)
- [ ] 10+ positive reviews

---

## 🚀 Next Steps (Right Now)

1. **Register Apple Developer** → https://developer.apple.com/programs/
2. **While waiting for approval** (24h):
   - Install Capacitor
   - Create app icon
   - Write privacy policy
3. **Once approved**:
   - Configure Xcode
   - Build & test
   - Submit

---

## 📞 Support

**Questions?**
- Apple Developer Support: https://developer.apple.com/support/
- Capacitor Docs: https://capacitorjs.com/docs/ios
- App Store Connect Guide: https://help.apple.com/app-store-connect/

**Emergency contacts**:
- Sam (you): [your email]
- Apple Support: developer@apple.com

---

🎉 **You're 2-3 days away from launching on the App Store!** 🚀

**Next action**: Register Apple Developer account NOW
