# AgentBill — First Play Store Release

The bottleneck to first revenue is not the build — it's the Play Console paperwork. This is the ordered checklist.

## Pre-conditions (one-time)

1. **Play Console developer account active** — assumed yes (Random-Timer is published from the same account).
2. **App created in Play Console** with package `com.iganapolsky.agentbill`:
   - Go to https://play.google.com/console
   - "Create app" → Name: `AgentBill`, Default language: English (US), App or game: App, Free or paid: Free (paid via subscription)
   - Accept Play App Signing.
3. **Internal testing track** — add at least 1 internal tester email (yours).
4. **Service account for Fastlane API uploads** (only required if you want CLI-driven upload):
   - Play Console → Setup → API access → Create service account → grant "Release manager" role
   - Download JSON key
   - Set `GOOGLE_PLAY_JSON_KEY_PATH=/path/to/json` in your shell

## Required listing assets (Internal track minimum)

Text — already drafted at `fastlane/metadata/android/en-US/`:
- [x] `title.txt` (≤30 chars)
- [x] `short_description.txt` (≤80 chars)
- [x] `full_description.txt` (≤4000 chars)
- [x] `changelogs/1.txt` (release notes)

Images — **not yet produced**, easy wins:
- [ ] App icon 512×512 PNG (32-bit, no alpha)
- [ ] Feature graphic 1024×500 PNG
- [ ] ≥2 phone screenshots 1080×1920 PNG (run app on emulator, take screenshots)
- [ ] (optional) 7" tablet screenshot
- [ ] (optional) Promo video URL (YouTube)

For the icon: a placeholder generated from the Material You icon is fine for Internal track. Replace before production.

Content / policy declarations — fill in Play Console UI:
- [ ] Content rating questionnaire (this app: no violence, no gambling, all answers "no")
- [ ] Target audience: 18+
- [ ] Data safety form: no personal data collected; xAI API key stays on device; analytics off
- [ ] Ads declaration: "No ads"
- [ ] News app declaration: No
- [ ] COVID-19 contact tracing: No
- [ ] Government app: No
- [ ] App access: declare BYO-key requirement so reviewers can test (paste a temporary xAI key in the App access form)

Privacy policy URL — required:
- [ ] Publish a privacy policy at a public URL (e.g., `https://thumbgate.ai/agentbill/privacy`) and paste in Play Console. Draft policy below in `privacy-policy-draft.md`.

## Subscription product (Pro)

After internal track is live, create in Play Console → Monetize → Subscriptions:
- Product ID: `agentbill_pro_monthly`
- Base price: $4.99 / month
- Free trial: 7 days (optional)
- Grace period: 7 days

The wiring in `app/.../core/billing/PlayBilling.kt` references this exact SKU.

## Build + upload

Once the app exists in Play Console:

```bash
cd android/agent-bill

# Build signed AAB (this scaffold already wired keystore + signing config)
JAVA_HOME=/opt/homebrew/opt/openjdk@17 \
ANDROID_HOME=$HOME/Library/Android/sdk \
./gradlew bundleRelease

# AAB is at: app/build/outputs/bundle/release/app-release.aab
ls -lh app/build/outputs/bundle/release/app-release.aab
```

Upload path A — Fastlane (after service account JSON is set):

```bash
GOOGLE_PLAY_JSON_KEY_PATH=/path/to/play-service-account.json \
bundle exec fastlane android internal
```

Upload path B — browser automation via your authenticated Chrome Canary:

```bash
# 1. Launch Chrome Canary with debug port (do this once, leave it running)
/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome Canary"

# 2. From a separate terminal:
cd android/agent-bill
node upload-to-playstore.js \
  --app-url "https://play.google.com/console/u/0/developers/5569424694437250668/app/4974052329761927376/tracks/internal"
```

Replace `internal` with the track ID if different.

## First-revenue path (realistic)

1. Internal track upload (day 1) — 1 tester, just you.
2. Sideload + manual run (day 1–2) — confirm BYO-key audit roundtrip works.
3. Closed (alpha) testing with the 9 soft-share recipients (day 3–5).
4. Production with subscription enabled (day 7+).

Revenue ETA: **earliest day 8 if everything ships cleanly.** Internal/Closed tracks do not bill. Production does.

Faster revenue path that does NOT wait for AgentBill: the 9 LinkedIn DMs already staged in `business_os/sales_assets/dm-drafts-ready-9.md` point directly to ThumbGate Pro's live Stripe checkout. Those convert today.
