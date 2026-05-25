import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const COMET_BIN = "/Applications/Comet.app/Contents/MacOS/Comet";
const COMET_PROFILE = join(homedir(), "Library/Application Support/Comet");
const DEV_ID = "8239620436488925047";

async function run() {
  console.log("Inspecting apps list via Comet...");

  if (!existsSync(COMET_BIN)) {
    console.error(`Comet binary not found at ${COMET_BIN}`);
    process.exit(1);
  }
  if (!existsSync(COMET_PROFILE)) {
    console.error(`Comet profile not found at ${COMET_PROFILE}`);
    process.exit(1);
  }

  try {
    execSync("killall Comet", { stdio: "ignore" });
    console.log("Closed Comet processes.");
  } catch (e) {}

  await new Promise(resolve => setTimeout(resolve, 3000));

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
    const url = `https://play.google.com/console/u/0/developers/${DEV_ID}/apps-list`;
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    
    // Wait for the apps list to load. We saw "7 apps" in the previous screenshot, so let's wait longer for the table.
    console.log("Waiting 15 seconds for apps table to load...");
    await page.waitForTimeout(15000);

    await page.screenshot({ path: "apps_list_loaded.png", fullPage: true });
    console.log("Saved screenshot to apps_list_loaded.png");

    // Let's inspect the text of the page to find any mention of "AgentBill" or "agentbill"
    const bodyText = await page.innerText("body");
    const containsAgentBill = bodyText.toLowerCase().includes("agentbill");
    console.log(`Body contains 'agentbill': ${containsAgentBill}`);

    // Let's print out all links on the page that match developer app console links
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => ({ text: a.innerText, href: a.href }))
        .filter(l => l.href.includes('/app/'));
    });
    console.log("Found app links:", JSON.stringify(links, null, 2));

  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    await ctx.close().catch(() => {});
    console.log("Done.");
  }
}

run();
