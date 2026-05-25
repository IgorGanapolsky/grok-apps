import { chromium } from "playwright";
import { existsSync, homedir } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const DEV_ID = "5569424694437250668";
const APP_ID = "4974052329761927376";
const DASHBOARD_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/dashboard`;

const CANARY_BIN = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const CANARY_PROFILE = join(homedir(), "Library", "Application Support", "Google", "Chrome Canary");

async function run() {
  console.log(`[automation] Starting 'Select testers' automation for AgentBill...`);

  if (!existsSync(CANARY_BIN)) {
    console.error(`Chrome Canary not found at ${CANARY_BIN}`);
    process.exit(1);
  }

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
        console.error("[automation] Browser profile is locked. Please close Chrome Canary or start it with:");
        console.error(`[automation] "${CANARY_BIN}" --remote-debugging-port=9222`);
        process.exit(1);
    }
    throw err;
  }

  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    console.log(`[automation] Navigating to Dashboard: ${DASHBOARD_URL}`);
    await page.goto(DASHBOARD_URL, { waitUntil: "networkidle", timeout: 60000 });

    if (page.url().includes("accounts.google.com")) {
      console.log("[automation] Login required. Please log in in the opened browser window. Waiting up to 2 min...");
      await page.waitForURL(/play\.google\.com\/console/, { timeout: 120_000 });
      console.log("[automation] Login detected. Proceeding...");
    }

    console.log("[automation] Looking for 'Select testers' link...");
    const selectTesters = page.locator('a:has-text("Select testers")').first();
    
    if (await selectTesters.count() > 0) {
      console.log("[automation] Found 'Select testers'. Clicking...");
      await selectTesters.click();
      await page.waitForLoadState("networkidle");
      
      console.log("[automation] Now on testers page. Checking for mailing lists...");
      // Check if 'Mailing lists' tab is active
      const mailingLists = page.locator('div[role="tab"]:has-text("Mailing lists")');
      if (await mailingLists.count() > 0) {
          await mailingLists.click();
      }

      // Look for a checkbox or a list to select
      // Usually there is a list of mailing lists with checkboxes
      const checkboxes = page.locator('mat-checkbox');
      const checkboxCount = await checkboxes.count();
      if (checkboxCount > 0) {
          console.log(`[automation] Found ${checkboxCount} mailing list(s). Selecting the first one...`);
          await checkboxes.first().click();
          
          const saveBtn = page.locator('button:has-text("Save changes")').first();
          if (await saveBtn.count() > 0) {
              await saveBtn.click();
              console.log("[automation] Changes saved.");
              await page.waitForTimeout(2000);
          }
      } else {
          console.log("[automation] No mailing lists found. You might need to create one first.");
          await page.screenshot({ path: "android/Agent-Bill/no_mailing_lists.png" });
      }

    } else {
      console.log("[automation] 'Select testers' link not found. Checking if already selected...");
      await page.screenshot({ path: "android/Agent-Bill/dashboard_state.png" });
    }

    console.log("[automation] Automation finished. Keeping browser open for 60s for review.");
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error(`[automation] Error: ${error.message}`);
    await page.screenshot({ path: "android/Agent-Bill/automation_error.png" });
  } finally {
    await ctx.close();
  }
}

run();
