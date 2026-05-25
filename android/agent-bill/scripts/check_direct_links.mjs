import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const COMET_BIN = "/Applications/Comet.app/Contents/MacOS/Comet";
const COMET_PROFILE = join(homedir(), "Library/Application Support/Comet");
const DEV_ID = "8239620436488925047";
const APP_PACKAGE = "com.iganapolsky.agentbill";

async function run() {
  console.log("Checking direct links via Comet...");

  if (!existsSync(COMET_BIN)) {
    console.error(`Comet binary not found at ${COMET_BIN}`);
    process.exit(1);
  }
  if (!existsSync(COMET_PROFILE)) {
    console.error(`Comet profile not found at ${COMET_PROFILE}`);
    process.exit(1);
  }

  // Safely close running Comet to release profile lock
  try {
    console.log("Closing active Comet processes...");
    execSync("killall Comet", { stdio: "ignore" });
    console.log("Comet closed successfully.");
  } catch (e) {
    console.log("No running Comet processes found.");
  }

  // Wait a brief moment for the lock file to be released by OS
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log(`Launching headed Comet using LIVE profile: ${COMET_PROFILE}`);
  const ctx = await chromium.launchPersistentContext(COMET_PROFILE, {
    headless: false,
    executablePath: COMET_BIN,
    viewport: { width: 1440, height: 900 },
    args: [
      "--no-first-run", 
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled"
    ],
    ignoreDefaultArgs: ["--enable-automation"]
  });

  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    const storeListingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_PACKAGE}/main-store-listing`;
    console.log(`Navigating to Store Listing: ${storeListingUrl}`);
    await page.goto(storeListingUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    
    // Wait for stability
    await page.waitForTimeout(10000);
    
    console.log("Saving Store Listing screenshot...");
    await page.screenshot({ path: "play_store_listing_direct.png", fullPage: true });

    const internalTestingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_PACKAGE}/internal-testing`;
    console.log(`Navigating to Internal Testing: ${internalTestingUrl}`);
    await page.goto(internalTestingUrl, { waitUntil: "domcontentloaded", timeout: 90000 });

    // Wait for stability
    await page.waitForTimeout(10000);

    console.log("Saving Internal Testing screenshot...");
    await page.screenshot({ path: "play_internal_testing_direct.png", fullPage: true });

  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    await ctx.close().catch(() => {});
    console.log("Direct links check complete.");
  }
}

run();
