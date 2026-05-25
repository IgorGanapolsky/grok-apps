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
  console.log("Testing upload flow...");

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
    ignoreDefaultArgs: ["--enable-automation", "--use-mock-keychain", "--password-store=basic"]
  });

  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    const url = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/main-store-listing`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(10000);

    // Save initial screenshot
    await page.screenshot({ path: "test_upload_1_loaded.png", fullPage: true });
    console.log("Saved test_upload_1_loaded.png");

    // Scroll to Graphics
    console.log("Scrolling to Graphics header...");
    await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("h1, h2, h3, div"));
      const target = headers.find(el => el.innerText && el.innerText.trim() === "Graphics");
      if (target) target.scrollIntoView();
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test_upload_2_scrolled.png", fullPage: true });

    // Broad locators
    const iconSection = page.locator('div:has-text("App icon"), div:has-text("App Icon"), section:has-text("App icon"), section:has-text("App Icon")').first();
    console.log("Locating input[type='file'] under App Icon section...");
    const fileInput = iconSection.locator('input[type="file"]').first();
    const exists = await fileInput.count() > 0;
    console.log(`Does input[type='file'] exist under App Icon container? ${exists}`);

    if (exists) {
      console.log("File input successfully resolved! Let's print some properties...");
      const tag = await fileInput.evaluate(el => el.tagName);
      console.log(`TagName of resolved element: ${tag}`);
    }
    
  } catch (err) {
    console.error(`Error during upload test: ${err.message}`);
    await page.screenshot({ path: "test_upload_failed.png", fullPage: true });
    console.log("Saved test_upload_failed.png");
  } finally {
    await ctx.close().catch(() => {});
    console.log("Done.");
  }
}

run();
