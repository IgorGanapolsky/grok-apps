import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const METADATA = join(ROOT, "fastlane/metadata/android/en-US");

const CANARY_BIN = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const CANARY_PROFILE = join(homedir(), "Library", "Application Support", "Google", "Chrome Canary");

const DEV_ID = "5569424694437250668";
const APP_ID = "4974052329761927376";

async function run() {
  console.log("[automated-publish] Starting AgentBill publication...");

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(CANARY_PROFILE, {
      headless: false,
      executablePath: CANARY_BIN,
      viewport: { width: 1440, height: 900 },
      ignoreDefaultArgs: ["--enable-automation", "--no-first-run", "--no-default-browser-check"],
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (err) {
    if (err.message.includes("lock") || err.message.includes("user data directory is already in use")) {
        console.error("[automated-publish] Browser profile is locked. Please close Chrome Canary or start it with:");
        console.error(`[automated-publish] "${CANARY_BIN}" --remote-debugging-port=9222`);
        process.exit(1);
    }
    throw err;
  }

  const page = ctx.pages()[0] || (await ctx.newPage());
  
  try {
    console.log("[publish] Checking for existing AgentBill app...");
    await page.goto(`https://play.google.com/console/u/0/developers/${DEV_ID}/apps-list`);
    
    // Check if we are on a login page
    if (page.url().includes("accounts.google.com")) {
      console.log("[publish] Login required. Please log in in the opened browser window. Waiting up to 2 min...");
      await page.waitForURL(/play\.google\.com\/console/, { timeout: 120_000 });
      console.log("[publish] Login detected. Proceeding...");
    }

    await page.waitForLoadState("networkidle");
    
    let appLink = page.locator(`a[href*="${APP_ID}"]`).first();
    if (!await appLink.count()) {
      appLink = page.locator('a:has-text("AgentBill")').first();
    }
    
    if (!await appLink.count()) {
      throw new Error(`AgentBill (ID: ${APP_ID}) not found in apps list.`);
    }
    
    const appUrl = await appLink.getAttribute("href");
    const fullAppUrl = new URL(appUrl, "https://play.google.com").href;
    console.log(`[publish] App URL: ${fullAppUrl}`);

    // 1. Main Store Listing
    console.log("[publish] Updating Main Store Listing...");
    await page.goto(`${fullAppUrl}/main-store-listing`, { waitUntil: "networkidle" });

    const title = readFileSync(join(METADATA, "title.txt"), "utf8").trim();
    const shortDesc = readFileSync(join(METADATA, "short_description.txt"), "utf8").trim();
    const fullDesc = readFileSync(join(METADATA, "full_description.txt"), "utf8").trim();

    await page.fill('input[aria-label="App name"]', title);
    await page.fill('textarea[aria-label="Short description"]', shortDesc);
    await page.fill('textarea[aria-label="Full description"]', fullDesc);

    // Upload Icon
    console.log("[publish] Uploading icon...");
    const iconInput = page.locator('input[type="file"]').first();
    await iconInput.setInputFiles(join(ROOT, "assets/icon_512.png"));
    
    // Upload Feature Graphic
    console.log("[publish] Uploading feature graphic...");
    const featureInput = page.locator('input[type="file"]').nth(1);
    await featureInput.setInputFiles(join(ROOT, "assets/feature_graphic.png"));

    // Upload Screenshots
    console.log("[publish] Uploading screenshots...");
    const screenshotInput = page.locator('input[type="file"]').nth(2);
    // Use files from assets or metadata images
    const screenshotsDir = join(ROOT, "android/Agent-Bill/assets/screenshots/");
    let screenshots = [];
    if (existsSync(screenshotsDir)) {
        screenshots = readdirSync(screenshotsDir)
            .filter(f => f.endsWith(".png"))
            .map(f => join(screenshotsDir, f))
            .slice(0, 8);
    }
    
    if (screenshots.length === 0) {
        // Fallback to METADATA images if assets not found
        const metadataImages = join(METADATA, "images/phoneScreenshots/");
        if (existsSync(metadataImages)) {
             screenshots = readdirSync(metadataImages)
                .filter(f => f.endsWith(".png"))
                .map(f => join(metadataImages, f))
                .slice(0, 8);
        }
    }

    if (screenshots.length > 0) {
        await screenshotInput.setInputFiles(screenshots);
    }

    await page.click('button:has-text("Save")');
    console.log("[publish] Store listing saved.");
    await page.waitForTimeout(3000);

    // 2. Internal Testing Release
    console.log("[publish] Creating Internal Testing Release...");
    await page.goto(`${fullAppUrl}/tracks/internal-testing`, { waitUntil: "networkidle" });

    const createRelease = page.getByRole("button", { name: /create new release/i }).first();
    const editRelease = page.getByRole("button", { name: /edit release/i }).first();
    
    if (await editRelease.count() && await editRelease.isVisible()) {
        await editRelease.click();
    } else if (await createRelease.count() && await createRelease.isVisible()) {
        await createRelease.click();
    }
    await page.waitForTimeout(2000);

    const aabPath = join(ROOT, "app/build/outputs/bundle/release/app-release.aab");
    const aabInput = page.locator('input[type="file"]').first();
    await aabInput.setInputFiles(aabPath);

    console.log("[publish] Waiting for AAB upload (up to 5 min)...");
    await page.waitForSelector('button:has-text("Save"):not([disabled])', { timeout: 300_000 });

    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Review release")');
    await page.waitForTimeout(2000);
    
    console.log("[publish] Done! Verify at https://play.google.com/console");
    await page.waitForTimeout(10000);
  } catch (err) {
    console.error("[publish] Error:", err);
    await page.screenshot({ path: join(ROOT, "publish_final_error.png") });
  } finally {
    await ctx.close();
  }
}

run();
