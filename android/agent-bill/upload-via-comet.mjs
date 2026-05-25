import { chromium } from "playwright";
import { existsSync, mkdtempSync, cpSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMET_BIN = "/Applications/Comet.app/Contents/MacOS/Comet";
const COMET_PROFILE = join(homedir(), "Library", "Application Support", "Comet");
const DEV_ID = "5283488806283188843";
const APP_PACKAGE = "com.iganapolsky.agentbill";
const TARGET_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_PACKAGE}/internal-testing`;

const AAB = resolve(__dirname, "app/build/outputs/bundle/release/app-release.aab");
const NOTES = "AgentBill v0.1.0 — initial Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.";

console.log("Starting automated upload using Comet profile...");

if (!existsSync(COMET_BIN)) {
  console.error(`Comet binary not found at ${COMET_BIN}`);
  process.exit(1);
}
if (!existsSync(COMET_PROFILE)) {
  console.error(`Comet profile not found at ${COMET_PROFILE}`);
  process.exit(1);
}
if (!existsSync(AAB)) {
  console.error(`AAB not found: ${AAB}`);
  process.exit(1);
}

// Check if Comet is running
try {
  execSync(`pgrep -f "Comet"`, { stdio: "ignore" });
  console.error("ERROR: Comet is already running. Please close it before running this script to use the live profile directly.");
  process.exit(1);
} catch (err) {
  // Not running
}

console.log(`[comet-upload] launching headed Comet with profile ${COMET_PROFILE}`);
const ctx = await chromium.launchPersistentContext(COMET_PROFILE, {
  headless: false, // headed so the user can see it!
  executablePath: COMET_BIN,
  viewport: { width: 1440, height: 900 },
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"],
});

const page = ctx.pages()[0] || (await ctx.newPage());

try {
  console.log(`[comet-upload] navigating to ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  if (page.url().includes("accounts.google.com")) {
    console.log("[comet-upload] redirected to login. Waiting 60s for manual login or session restore...");
    await page.waitForTimeout(60000);
  }

  console.log('[comet-upload] checking if already on release page or need to click "Create new release"');
  
  // Wait for page to fully render
  await page.waitForTimeout(5000);

  // Look for "Create new release" button
  const createButton = page.getByRole("button", { name: /create new release/i }).first();
  if (await createButton.count() > 0 && await createButton.isVisible()) {
    console.log("[comet-upload] clicking 'Create new release'...");
    await createButton.click();
    await page.waitForTimeout(3000);
  } else {
    console.log("[comet-upload] 'Create new release' button not visible or already in draft release creation.");
  }

  // Double check if there's an active "Edit release" instead
  const editButton = page.getByRole("button", { name: /edit release/i }).first();
  if (await editButton.count() > 0 && await editButton.isVisible()) {
    console.log("[comet-upload] clicking 'Edit release'...");
    await editButton.click();
    await page.waitForTimeout(3000);
  }

  console.log(`[comet-upload] uploading AAB: ${AAB}`);
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(AAB);

  console.log("[comet-upload] waiting for upload and processing (up to 3 minutes)…");
  // Wait for the upload card to show progress or Save button to be enabled
  await page.waitForTimeout(15000);
  
  // Wait for "Save" or "Save as draft" button
  const saveButton = page.locator('button:has-text("Save"), button:has-text("Save as draft")').first();
  await saveButton.waitFor({ state: "visible", timeout: 180000 });
  console.log("[comet-upload] upload finished!");

  console.log("[comet-upload] filling release notes");
  const notesField = page.locator("textarea").first();
  if (await notesField.count()) {
    await notesField.fill(NOTES);
    await page.waitForTimeout(1000);
  }

  console.log("[comet-upload] saving release...");
  await saveButton.click();
  await page.waitForTimeout(4000);

  console.log("[comet-upload] reviewing release...");
  const review = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
  if (await review.count()) {
    await review.click();
    await page.waitForTimeout(3000);
  }

  console.log("[comet-upload] taking final screenshot...");
  await page.screenshot({ path: "/Users/igorganapolsky/workspace/git/igor/grok-apps/play_console_rollout_ready.png" });

  console.log("[comet-upload] release staged successfully! Leaving browser open for 60s for review...");
  await page.waitForTimeout(60000);

} catch (error) {
  console.error(`[comet-upload] Error occurred: ${error.message}`);
  try {
    await page.screenshot({ path: "/Users/igorganapolsky/workspace/git/igor/grok-apps/play_console_upload_error.png" });
  } catch (e) {}
} finally {
  await ctx.close();
  console.log("[comet-upload] finished.");
}
