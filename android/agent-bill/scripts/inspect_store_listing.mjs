import { chromium } from "playwright";
import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const COMET_BIN = "/Applications/Comet.app/Contents/MacOS/Comet";
const COMET_PROFILE = join(homedir(), "Library/Application Support/Comet");
const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
  console.log("Inspecting Store Listing page structure...");

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
    const url = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/main-store-listing`;
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    
    console.log("Waiting for Name of the app input to ensure page is loaded...");
    await page.waitForSelector('input[aria-label="Name of the app"]', { timeout: 45000 }).catch(e => console.log("Timeout waiting for Name of the app input, continuing..."));
    await page.waitForTimeout(5000);

    try {
      await page.screenshot({ path: "store_listing_page.png" });
      console.log("Saved screenshot to store_listing_page.png");
    } catch (e) {
      console.log("Screenshot failed: " + e.message);
    }

    // Dump all inputs and textareas
    const fields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, textarea")).map(el => ({
        tagName: el.tagName,
        type: el.getAttribute("type"),
        ariaLabel: el.getAttribute("aria-label"),
        placeholder: el.getAttribute("placeholder"),
        value: el.value ? el.value.substring(0, 100) : "",
        id: el.id,
        className: el.className
      }));
      
      const buttons = Array.from(document.querySelectorAll("button")).map(el => ({
        text: el.innerText.trim(),
        ariaLabel: el.getAttribute("aria-label"),
        id: el.id,
        className: el.className
      })).filter(b => b.text.length > 0);

      const fileInputs = Array.from(document.querySelectorAll("input[type='file']")).map(el => ({
        tagName: el.tagName,
        ariaLabel: el.getAttribute("aria-label"),
        id: el.id,
        className: el.className
      }));

      return { inputs, buttons, fileInputs };
    });

    writeFileSync("store_listing_fields.json", JSON.stringify(fields, null, 2));
    console.log("Dumped form field metadata to store_listing_fields.json");

  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    await ctx.close().catch(() => {});
    console.log("Done.");
  }
}

run();
