# AgentBill — Android

Native Kotlin/Compose Android app. BYO-key AI bill auditor for xAI / Anthropic / OpenAI. Pastes a transcript or invoice in, gets back repeat-offender patterns and estimated monthly $ each.

**Funnel target:** ThumbGate Pro ($19/mo) for desktop tool-call enforcement of the patterns the audit finds.

**Monetization:** Play Billing subscription `agentbill_pro_monthly` at $4.99/mo (scaffold only — Pro SKU created in next milestone). Free tier: 3 audits/day. Pro: unlimited + push alerts + multi-provider.

## Layout

```
app/src/main/java/com/iganapolsky/agentbill/
  MainActivity.kt          // Compose entry, NavHost
  AgentBillApp.kt          // @HiltAndroidApp
  ui/
    HomeScreen.kt          // landing — quick audit + settings entry
    AuditScreen.kt         // paste transcript, run, show result
    AuditViewModel.kt      // calls SkillLoader + GrokApiClient
    SettingsScreen.kt      // BYO xAI key, Pro upsell, ThumbGate cross-promo
    SettingsViewModel.kt
    theme/Theme.kt
  core/
    api/GrokApiClient.kt   // Ktor + xAI /v1/chat/completions
    skills/SkillLoader.kt  // loads assets/skills/*.md
    billing/PlayBilling.kt // stub for Play Billing wiring
  data/
    KeyStore.kt            // DataStore for BYO API key (local-only)
app/src/main/assets/skills/
  ai-bill-auditor.md       // bundled copy of the Grok Skill spec (drives the system prompt)
```

## Build

```bash
cd android/agent-bill
./gradlew assembleDebug   # APK at app/build/outputs/apk/debug/
./gradlew installDebug    # installs to a connected device/emulator
```

Requires JDK 17 and Android SDK 35.

## Why this app exists

Play Store search for "AI cost tracker" returns generic personal-finance apps with "AI" as a buzzword. Nobody is auditing developer-side AI provider bills on mobile. The Grok Skill `/ai-bill-auditor` covers the audit logic — this app makes it native, persistent, and push-notifiable; and funnels the high-pain users into [ThumbGate](https://thumbgate.ai) for the prevention layer.

## Roadmap

1. **v0.1 (this scaffold)** — buildable APK, hand-keyed audit, no billing flow yet, single provider (xAI).
2. **v0.2** — Play Billing wired, Pro SKU created in Play Console, free-tier rate limit (3/day).
3. **v0.3** — Anthropic + OpenAI providers, background bill-spike notifications via WorkManager.
4. **v0.4** — fastlane + GitHub Actions release pipeline, mirroring the Random-Timer setup.
5. **v0.5** — Internal Track upload; closed beta with the 5 soft-share recipients from `business_os/sales_assets/soft-share-dms.md`.

## Cross-promo block

- [ThumbGate Pro](https://thumbgate.ai/checkout/pro?utm_source=agentbill-android&utm_medium=app&utm_campaign=readme) — desktop Pre-Action Gates that block the patterns this app finds.
- [OpenClaw Console](https://github.com/IgorGanapolsky/openclaw-console) — mobile cockpit for approving self-hosted agent actions.
- [AnswerGuard](https://github.com/IgorGanapolsky/AnswerGuard) — privacy-first scam call protection.
- [Random Tactical Timer](https://github.com/IgorGanapolsky/Random-Timer) — train for chaos, not rhythm.
