import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
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

console.log("Starting direct upload using live Comet profile...");

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

// Safely close running Comet to release profile lock
try {
  console.log("Closing active Comet processes to release profile lock...");
  execSync("killall Comet", { stdio: "ignore" });
  console.log("Comet closed successfully.");
} catch (e) {
  console.log("No running Comet processes found (already closed).");
}

// Wait a brief moment for the lock file to be released by OS
console.log("Waiting 3s for system to release lock...");
await new Promise(resolve => setTimeout(resolve, 3000));

console.log(`[comet-direct] launching headed Comet using LIVE profile: ${COMET_PROFILE}`);
const ctx = await chromium.launchPersistentContext(COMET_PROFILE, {
  headless: false, // headed so they see the upload happening live
  executablePath: COMET_BIN,
  viewport: { width: 1440, height: 900 },
  args: ["--no-first-run", "--no-default-browser-check"],
});

const page = ctx.pages()[0] || (await ctx.newPage());

try {
  console.log(`[comet-direct] navigating to ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  if (page.url().includes("accounts.google.com")) {
    console.log("[comet-direct] Warning: redirected to login. Waiting 60s for manual input if needed...");
    await page.waitForTimeout(60000);
  }

  // Wait for page load and stabilize
  await page.waitForTimeout(5000);

  // Look for "Create new release" button
  console.log("[comet-direct] checking for release buttons...");
  const createButton = page.getByRole("button", { name: /create new release/i }).first();
  if (await createButton.count() > 0 && await createButton.isVisible()) {
    console.log("[comet-direct] clicking 'Create new release'...");
    await createButton.click();
    await page.waitForTimeout(3000);
  } else {
    // If not visible, check for "Edit release" (in case draft already exists)
    const editButton = page.getByRole("button", { name: /edit release/i }).first();
    if (await editButton.count() > 0 && await editButton.isVisible()) {
      console.log("[comet-direct] clicking 'Edit release'...");
      await editButton.click();
      await page.waitForTimeout(3000);
    } else {
      console.log("[comet-direct] no release button found, might be already on the upload form.");
    }
  }

  console.log(`[comet-direct] uploading AAB: ${AAB}`);
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(AAB);

  console.log("[comet-direct] waiting for upload to complete and process (up to 3 minutes)…");
  await page.waitForTimeout(15000);
  
  // Wait for the Save button to be visible and enabled
  const saveButton = page.locator('button:has-text("Save"), button:has-text("Save as draft")').first();
  await saveButton.waitFor({ state: "visible", timeout: 180000 });
  console.log("[comet-direct] AAB uploaded successfully!");

  console.log("[comet-direct] filling release notes...");
  const notesField = page.locator("textarea").first();
  if (await notesField.count()) {
    await notesField.fill(NOTES);
    await page.waitForTimeout(1000);
  }

  console.log("[comet-direct] saving release draft...");
  await saveButton.click();
  await page.waitForTimeout(4000);

  console.log("[comet-direct] moving to review page...");
  const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
  if (await reviewButton.count()) {
    await reviewButton.click();
    await page.waitForTimeout(3000);
  }

  console.log("[comet-direct] taking staging screenshot...");
  await page.screenshot({ path: "/Users/igorganapolsky/workspace/git/igor/grok-apps/play_console_rollout_ready.png" });

  console.log("[comet-direct] release successfully staged! Leaving browser open 30s to preserve visual state...");
  await page.waitForTimeout(30000);

} catch (error) {
  console.error(`[comet-direct] Error occurred: ${error.message}`);
  try {
    await page.screenshot({ path: "/Users/igorganapolsky/workspace/git/igor/grok-apps/play_console_upload_error.png" });
  } catch (e) {}
} finally {
  await ctx.close();
  console.log("[comet-direct] closed browser. Complete.");
}
