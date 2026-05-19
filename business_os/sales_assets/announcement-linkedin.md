# LinkedIn — Skills Launch Announcement

**Status:** drafted, NOT sent. Posting needs your explicit go-ahead and a final read for tone.

**Channel:** Igor's personal LinkedIn feed.
**Target audience:** AI tool builders, AI-curious senior engineers, fractional CTOs, agency owners running Claude Code / Cursor / Codex.
**Goal:** drive `utm_source=grok-skill&utm_campaign=ai-bill-auditor` clicks through to `thumbgate.ai/checkout/pro`.

---

## Post body

> Your AI coding bill is bleeding from the same mistake on repeat.
>
> Every retry loop, every hallucinated import, every "let me try a different approach" is billable tokens — on Sonnet 4.6, on Opus 4.7, on Gemini 3.5, on whatever you're paying for this month.
>
> I just shipped a free Grok Skill that audits your bill for repeat-offender patterns:
>
> → /ai-bill-auditor
>
> Paste your last week of Cursor / Claude Code / Codex transcripts (or your last invoice line items). It returns:
>
> • the top repeat-offender patterns with estimated monthly $ each
> • the one-line prevention rule that would have skipped every repeat
> • total monthly $ recoverable if you enforce them all
>
> Runs inside Grok — works on web, iOS Grok, Android Grok. Zero install.
>
> Block the patterns permanently → ThumbGate Pro ($19/mo, OSS-core free): thumbgate.ai
>
> Skill bundle for self-hosted Grok / inspection: github.com/IgorGanapolsky/grok-apps

---

## Variant A — opener test (shorter, harsher)

> Your Anthropic bill went up 3x last month. Here's why and what to do.
>
> [Same body from "Every retry loop…" onward.]

## Variant B — opener test (curiosity)

> I built a Grok Skill that reads your AI coding bill and tells you which mistakes are billing you twice.
>
> [Same body.]

## Variant C — ROI Clarity (Hard-hitting)

> **"Let me try a different approach."**
>
> That one sentence just cost you $0.44.
>
> 7 retry loops × 4,200 tokens × $15/1M output.
>
> Do that 200x a month across your team and you’re paying $88 for the exact same lesson your agent never learned. 
>
> Your AI bill is bleeding from "The Repeat Tax."
>
> I built a free Grok Skill that stops the guesswork and audits your bill for these repeat-offender patterns.
>
> → **`/ai-bill-auditor`**
>
> Paste your last week of Cursor / Claude Code / Codex transcripts. It returns:
>
> • Top patterns with estimated monthly $ leak
> • The one-line prevention rule to skip the repeat
> • Total monthly $ recoverable
>
> Runs in Grok (web/iOS/Android). Zero install.
>
> Block the patterns permanently: **thumbgate.ai**

---

## Posting rules (per operator framework)

- Ship variants A/B/C as separate posts a week apart, not as a thread. LinkedIn's algorithm penalizes repeated content within 7 days.
- Reply to every comment within 4h of post-time (per `DISTRIBUTION_RUNBOOK.md` midday window).
- Do not @ tag anyone in the post body — algorithmic penalty for cold @-mentions.
- Add the skill's GIF or 30s screen recording as the post media. Posts with media get ~3x reach vs. text-only.
- Track conversions in PostHog filter: `event = pageview AND properties.utm_campaign = ai-bill-auditor`.

## Approval queue

- [ ] Read the post body for tone — Igor's voice is direct, not corporate; flag anything that sounds like a pitch deck.
- [ ] Confirm we lead with variant A (recommended — strongest hook for ThumbGate's existing audience).
- [ ] Confirm we have a 30s recording of the skill in action (or accept text-only on day-1 launch).
- [ ] Confirm the GitHub URL is live before posting.
