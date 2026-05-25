import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

async function run() {
  const CANARY_BIN = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
  const CANARY_PROFILE = "/Users/igorganapolsky/Library/Application Support/Google/Chrome Canary";
  const DEV_ID = "5569424694437250668";
  const TARGET_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/apps-list`;

  console.log("Starting Play Console status check...");

  if (!existsSync(CANARY_BIN)) {
    console.error(`Chrome Canary not found at ${CANARY_BIN}`);
    process.exit(1);
  }

  let browser;
  try {
    browser = await chromium.launchPersistentContext(CANARY_PROFILE, {
        headless: false, // HEADED as requested
        executablePath: CANARY_BIN,
        viewport: { width: 1440, height: 900 },
        ignoreDefaultArgs: ["--enable-automation", "--no-first-run", "--no-default-browser-check"],
        args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (err) {
    if (err.message.includes("lock") || err.message.includes("user data directory is already in use")) {
        console.error("Browser profile is locked. Please close Chrome Canary or start it with:");
        console.error(`"${CANARY_BIN}" --remote-debugging-port=9222`);
        process.exit(1);
    }
    throw err;
  }

  const page = browser.pages()[0] || (await browser.newPage());

  try {
    console.log(`Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });

    if (page.url().includes("accounts.google.com")) {
      console.log("Login required. Waiting 30s for manual intervention...");
      await page.waitForTimeout(30000);
      // Re-check after wait
      if (page.url().includes("accounts.google.com")) {
        console.log("Still on login page after 30s.");
      }
    }

    // Search for 'AgentBill'
    console.log("Searching for 'AgentBill'...");
    const searchInput = page.locator('input[aria-label*="Search"], input[placeholder*="Search"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill("AgentBill");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(5000); // Wait for results
    } else {
      console.log("Search input not found, checking page content directly.");
    }

    const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/play_console_status.png";
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved as ${screenshotPath}`);

    const content = await page.content();
    if (content.toLowerCase().includes("agentbill")) {
      console.log("Found 'AgentBill' in page content.");
      const rows = page.locator('tr');
      const rowCount = await rows.count();
      let found = false;
      for (let i = 0; i < rowCount; i++) {
        try {
          const text = await rows.nth(i).innerText();
          if (text.toLowerCase().includes("agentbill")) {
            console.log(`APP_STATUS_FOUND: ${text.replace(/\n/g, ' | ')}`);
            found = true;
            break;
          }
        } catch (e) {}
      }
      if (!found) {
        console.log("AgentBill found in text but couldn't pinpoint status row.");
      }
    } else {
      console.log("APP_NOT_FOUND");
    }

  } catch (error) {
    console.error(`Error during execution: ${error.message}`);
    try {
      await page.screenshot({ path: "/Users/igorganapolsky/workspace/git/igor/grok-apps/play_console_error.png" });
    } catch (e) {}
  } finally {
    await browser.close();
  }
}

run();
