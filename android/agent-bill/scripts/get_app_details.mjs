import { chromium } from "playwright";
import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const COMET_BIN = "/Applications/Comet.app/Contents/MacOS/Comet";
const COMET_PROFILE = join(homedir(), "Library/Application Support/Comet");
const DEV_ID = "8239620436488925047";

async function run() {
  console.log("Starting DOM detail extraction via Comet...");

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
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    
    // Wait longer and ensure the page is stable
    console.log("Waiting 20 seconds for page to be completely rendered...");
    await page.waitForTimeout(20000);

    // Save a screenshot
    await page.screenshot({ path: "dom_check_screenshot.png", fullPage: true });

    // Print all visible texts that contain AgentBill
    const matchingElements = await page.evaluate(() => {
      const results = [];
      // Search all elements on page
      const allElements = document.getElementsByTagName("*");
      for (const el of allElements) {
        if (el.textContent && el.textContent.includes("AgentBill") && el.children.length === 0) {
          results.push({
            tagName: el.tagName,
            text: el.textContent.trim(),
            className: el.className,
            parentId: el.parentElement ? el.parentElement.id : null,
            parentClass: el.parentElement ? el.parentElement.className : null
          });
        }
      }
      return results;
    });

    console.log("Elements containing 'AgentBill':", JSON.stringify(matchingElements, null, 2));

    // Inspect the table structure and row texts
    const tableRows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("tr, [role='row']")).map(r => r.innerText.replace(/\n/g, " | "));
    });
    console.log("Table/Row inner texts:", JSON.stringify(tableRows, null, 2));

    // Get all anchor elements and their hrefs
    const anchors = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a")).map(a => ({
        text: a.innerText.trim().replace(/\n/g, " | "),
        href: a.href
      }));
    });
    writeFileSync("extracted_anchors.json", JSON.stringify(anchors, null, 2));
    console.log(`Dumped ${anchors.length} anchors to extracted_anchors.json`);

  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    await ctx.close().catch(() => {});
    console.log("Extraction complete.");
  }
}

run();
