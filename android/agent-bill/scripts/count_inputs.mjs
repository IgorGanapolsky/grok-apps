import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const COMET_BIN = "/Applications/Comet.app/Contents/MacOS/Comet";
const COMET_PROFILE = join(homedir(), "Library/Application Support/Comet");
const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
  console.log("Counting file inputs...");

  try {
    execSync("killall Comet", { stdio: "ignore" });
  } catch (e) {}

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Clean lock files
  for (const lock of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    try {
      execSync(`rm "${join(COMET_PROFILE, lock)}"`, { stdio: "ignore" });
    } catch (e) {}
  }

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
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    
    console.log("Waiting for App Name input...");
    await page.waitForSelector('input[aria-label="Name of the app"]', { timeout: 30000 });
    console.log("App Name input found! Page is loaded.");

    const count = await page.locator('input[type="file"]').count();
    console.log(`GLOBAL FILE INPUT COUNT: ${count}`);

    for (let i = 0; i < count; i++) {
      const isVisible = await page.locator('input[type="file"]').nth(i).isVisible();
      console.log(`Input ${i}: visible = ${isVisible}`);
    }

  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    await ctx.close().catch(() => {});
  }
}

run();
