# 9 Polished LinkedIn DMs — Ready to Send

Each DM is also staged as a Gmail draft titled `LinkedIn DM ready → <Name>` in iganapolsky@gmail.com so you can copy-paste from mobile.

3 of the original 12 (Boris Cherny, Mike Krieger, Farhan Thawar) are already marked Sent in `leads.csv`. The 9 below are the remainder.

Send rules (from operator framework + ThumbGate distribution runbook):
- Max 5 sends per 24h to avoid LinkedIn flags
- Wait 72h before any follow-up
- Log every send back in `leads.csv` (flip Status from "Targeted" → "Sent")
- Reply to every reply within 4h during their daytime

---

## 1. Michael Truell — Cursor (Anysphere), CEO

LinkedIn: https://www.linkedin.com/in/michaeltruell/

> Michael — Cursor's the gold standard for agentic IDEs. The operator pain I keep hearing from heavy Cursor users: they can't see which of their patterns are burning the most tokens on repeat.
>
> I built a free Grok Skill — /ai-bill-auditor — that takes a session log and returns the repeat-offender patterns with $/month each. OSS bundle: github.com/IgorGanapolsky/grok-apps
>
> If the output ever surfaces something Cursor's billing team would find useful, would love a 5-min reaction.
>
> — Igor

---

## 2. Thibault Sottiaux — OpenAI, Product Platform Lead (Codex)

LinkedIn: https://www.linkedin.com/in/tsottiaux/

> Thibault — congrats on the Codex platform lead role.
>
> Built a Grok Skill (/ai-bill-auditor) that quantifies the cost of agent retry loops — specifically the "try → fail → try again with the same flawed plan" pattern that skips whatever memory layer the user has. OSS: github.com/IgorGanapolsky/grok-apps
>
> Curious if Codex enterprise customers are surfacing the same "why is my bill 3x?" complaint, and whether you'd want the audit to attribute by tool-call class.
>
> — Igor

---

## 3. Alexander Embiricos — OpenAI, Product Lead (Codex)

LinkedIn: https://www.linkedin.com/in/aembiricos/

> Alexander — saw your write-up on advanced Codex workflows.
>
> The cost gap I keep finding in parallelized agent runs: the same wrong sub-plan gets attempted across N branches because the failure signal doesn't propagate across the swarm. Built a free Grok Skill (/ai-bill-auditor) that ingests a session log and outputs the repeat-offender patterns with $/month each. OSS: github.com/IgorGanapolsky/grok-apps
>
> If parallel Codex workflows make this worse, the audit output should be loud. Happy to walk through what it surfaces on a real log if you have one.
>
> — Igor

---

## 4. Rachel Laycock — Thoughtworks, Global CTO

LinkedIn: https://www.linkedin.com/in/rachellaycock/

> Rachel — your piece on GenAI modernization was on point about the execution gap.
>
> The pattern I see at consultancies: the agent makes the same wrong call across client engagements because there's no enforcement boundary that travels with the codebase. I built ThumbGate — pre-action gates that intercept tool calls and block known-failure patterns before they run. Free MIT core: npx thumbgate init. github.com/IgorGanapolsky/ThumbGate
>
> Companion free Grok Skill that quantifies the cost of the repeats: /ai-bill-auditor.
>
> Would love your read on whether the gate-as-deliverable fits Thoughtworks' agentic engagements.
>
> — Igor

---

## 5. Mike Mason — Thoughtworks, Chief AI Officer

LinkedIn: https://www.linkedin.com/in/mikemason/

> Mike — Haven is a great reference model.
>
> The scale problem I keep seeing in assistants like it: the same repeated mistake is a few cents per agent run, but fan it across a consultancy and it's a real line item. ThumbGate is the OSS gate I built that lives at the PreToolUse boundary and blocks the known-failure patterns. Free MIT: npx thumbgate init. github.com/IgorGanapolsky/ThumbGate
>
> Also a free Grok Skill that audits the cost end-to-end: /ai-bill-auditor.
>
> Curious whether the gates pattern fits Haven's setup, or if you've already solved the repeats internally.
>
> — Igor

---

## 6. Karthik Srinivasan — Thoughtworks, Global Head of Agentic AI Platforms

LinkedIn: https://www.linkedin.com/in/srinivasankarthik/

> Karthik — your post on agentic platforms framed it right: enforcement, not vibes.
>
> ThumbGate is the OSS gate I built that lives at the PreToolUse boundary — intercepts tool calls, blocks known-failure patterns, ships with 5 built-ins and lets you auto-promote new ones from thumbs-down feedback. Free MIT: npx thumbgate init. github.com/IgorGanapolsky/ThumbGate
>
> Curious whether Thoughtworks' agentic platform has a similar boundary today, or whether the safety layer is still all in-context.
>
> — Igor

---

## 7. Birgitta Böckeler — Thoughtworks, Global Lead (AI-Assisted Delivery)

LinkedIn: https://www.linkedin.com/in/bboeckeler/

> Birgitta — your harness engineering talk articulated the loop better than anything I'd seen.
>
> "Thumbs-down captures a lesson, lesson becomes a prevention rule, rule blocks future repeats" — that's literally the ThumbGate primitive. Free MIT: npx thumbgate init. github.com/IgorGanapolsky/ThumbGate
>
> If you have 5 min I'd love your read on whether the lesson-promotion threshold (default: 2 occurrences) matches what you've actually seen work at your scale. We've been adjusting it from feedback and would value your gut check.
>
> — Igor

---

## 8. Eric Paulsen — Coder, Field CTO EMEA

LinkedIn: https://www.linkedin.com/in/ericpaulsen17/

> Eric — your PlatformCon talk on agents in regulated industries was on the exact problem ThumbGate solves: blocking unsafe tool calls before execution.
>
> Pre-Action Gates with biometric approval, audit trail, configurable per repo. Free MIT core: npx thumbgate init. github.com/IgorGanapolsky/ThumbGate
>
> Companion mobile cockpit (biometric approve from phone, audit log on-device): github.com/IgorGanapolsky/openclaw-console.
>
> If Coder users are asking for agent governance on top of CDEs, this might be the missing primitive. Would love your read.
>
> — Igor

---

## 9. Addy Osmani — Google, Director of Engineering (Chrome)

LinkedIn: https://www.linkedin.com/in/addyosmani/

> Addy — your bar for AI engineering standards is higher than most.
>
> Built a free Grok Skill (/ai-bill-auditor) that audits agent sessions for deviations from those standards and quantifies the cost of each repeated deviation. OSS: github.com/IgorGanapolsky/grok-apps
>
> Also ThumbGate, the OSS gate that blocks the deviations at the tool-call level — free MIT, npx thumbgate init. github.com/IgorGanapolsky/ThumbGate
>
> Curious whether the Chrome AI engineering team has internal tooling that does the gating piece, or whether it's still a manual review step.
>
> — Igor

---

## Send queue (suggested order, max 5/day)

**Day 1 (today):** 1 Michael Truell · 4 Rachel Laycock · 9 Addy Osmani · 7 Birgitta Böckeler · 8 Eric Paulsen
**Day 2:** 2 Thibault Sottiaux · 3 Alexander Embiricos · 5 Mike Mason · 6 Karthik Srinivasan

Day 1 mix balances 1 founder-level reply target (Truell), 2 thought leaders (Laycock, Osmani), 2 mid-leverage (Böckeler, Paulsen). If any of Day 1 reply quickly, hold Day 2 and convert that thread to a real conversation before adding noise.
