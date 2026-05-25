#!/usr/bin/env node
// Drives Google Play Console using a copy of your Chrome Canary profile so
// cookies / auth persist — no need to launch Chrome Canary separately or
// expose a debug port. Closes any open Canary first if needed.
//
// Usage:
//   cd android/agent-bill
//   node upload-via-canary-profile.mjs \
//     --app-url "https://play.google.com/console/u/1/developers/.../tracks/..." \
//     [--aab path/to/app-release.aab] \
//     [--notes "release notes"]
//
// If your Chrome Canary is currently running, the script copies the profile
// to a temp dir first so we don't conflict with the live browser.

import { chromium } from "playwright";
import { existsSync, mkdtempSync, cpSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const argv = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) => {
    if (!a.startsWith("--")) return [];
    const key = a.replace(/^--/, "");
    const next = arr[i + 1];
    return [[key, next && !next.startsWith("--") ? next : true]];
  })
);

const APP_URL = argv["app-url"];
if (!APP_URL) {
  console.error("--app-url is required");
  process.exit(1);
}
const AAB =
  argv.aab ||
  resolve(__dirname, "app/build/outputs/bundle/release/app-release.aab");
const NOTES =
  argv.notes ||
  "AgentBill v0.1.0 — initial Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.";

if (!existsSync(AAB)) {
  console.error(`AAB not found: ${AAB}`);
  process.exit(1);
}

const CANARY_BIN =
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const CANARY_PROFILE = join(
  homedir(),
  "Library",
  "Application Support",
  "Google",
  "Chrome Canary"
);

if (!existsSync(CANARY_BIN)) {
  console.error(`Chrome Canary not at ${CANARY_BIN}`);
  process.exit(1);
}
if (!existsSync(CANARY_PROFILE)) {
  console.error(`Canary profile not at ${CANARY_PROFILE}`);
  process.exit(1);
}

// Check if Canary is currently running
try {
  execSync(`pgrep -f "Google Chrome Canary"`, { stdio: "ignore" });
  console.error("ERROR: Google Chrome Canary is already running. Please close it before running this script to use the live profile directly.");
  process.exit(1);
} catch {
  // Not running
}

console.log(`[upload] launching headed Chrome Canary with profile ${CANARY_PROFILE}`);
const ctx = await chromium.launchPersistentContext(CANARY_PROFILE, {
  headless: false,
  executablePath: CANARY_BIN,
  viewport: { width: 1440, height: 900 },
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"],
});

const page = ctx.pages()[0] || (await ctx.newPage());

console.log(`[upload] navigating → ${APP_URL}`);
await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});

// Bail if redirected to sign-in.
if (page.url().includes("accounts.google.com")) {
  console.error(
    "[upload] redirected to Google sign-in. The copied profile may not have valid session cookies. " +
      "Try closing Chrome Canary first and re-running, so this script uses your live profile directly."
  );
  await page.waitForTimeout(60_000); // give user time to manually log in
}

console.log('[upload] looking for "Create new release"');
const create = page
  .getByRole("button", { name: /create new release/i })
  .first();
if (await create.count()) {
  await create.click();
  await page.waitForTimeout(2000);
} else {
  console.log(
    "[upload] no 'Create new release' button visible — already on a release page or different state"
  );
}

console.log(`[upload] uploading AAB: ${AAB}`);
const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles(AAB);

console.log("[upload] waiting for upload (≤2 min)…");
await page.waitForSelector('button:has-text("Save"):not([disabled])', {
  timeout: 120_000,
});

console.log("[upload] filling release notes");
const notesField = page.locator("textarea").first();
if (await notesField.count()) {
  await notesField.fill(NOTES);
  await page.waitForTimeout(1000);
}

console.log("[upload] save → review → rollout");
await page.click('button:has-text("Save"):not([disabled])');
await page.waitForTimeout(2500);

const review = page.getByRole("button", { name: /review release/i }).first();
if (await review.count()) await review.click();
await page.waitForTimeout(2000);

const rollout = page.getByRole("button", { name: /start rollout/i }).first();
if (await rollout.count()) {
  await rollout.click();
  console.log("[upload] rollout started");
} else {
  console.warn(
    "[upload] no 'Start rollout' button visible — finish rollout in the UI"
  );
}

console.log(
  "[upload] done. Leaving browser open for 60s in case you want to review."
);
await page.waitForTimeout(60_000);
await ctx.close();
