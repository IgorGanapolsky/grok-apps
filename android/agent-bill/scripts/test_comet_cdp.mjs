import { chromium } from "playwright";
import { execSync } from "node:child_process";

async function run() {
  console.log("Testing native Comet launch with remote debugging port...");

  try {
    console.log("Closing active Comet processes...");
    execSync("killall Comet", { stdio: "ignore" });
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {}

  console.log("Launching Comet natively in the background...");
  const cmd = `nohup /Applications/Comet.app/Contents/MacOS/Comet --remote-debugging-port=9222 > /dev/null 2>&1 &`;
  execSync(cmd);
  
  console.log("Waiting 6 seconds for Comet to start...");
  await new Promise(resolve => setTimeout(resolve, 6000));

  console.log("Connecting to Comet via CDP...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const ctx = browser.contexts()[0];
  if (!ctx) {
    throw new Error("No browser context found!");
  }

  const pages = await ctx.pages();
  console.log(`Open pages count: ${pages.length}`);
  
  let page = pages.find(p => p.url().includes("play.google.com"));
  if (!page) {
    console.log("Opening new tab for Play Console...");
    page = await ctx.newPage();
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    const url = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/main-store-listing";
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    
    console.log("Waiting for App Name input...");
    await page.waitForSelector('input[aria-label="Name of the app"]', { timeout: 30000 });
    console.log("App Name input found! Page is loaded.");

    const count = await page.locator('input[type="file"]').count();
    console.log(`GLOBAL FILE INPUT COUNT: ${count}`);

    for (let i = 0; i < count; i++) {
      console.log(`Input ${i} exists!`);
    }

  } catch (err) {
    console.error(`Error: ${err.message}`);
    try {
      await page.screenshot({ path: "test_comet_cdp_error.png" });
      console.log("Saved screenshot to test_comet_cdp_error.png");
    } catch (se) {
      console.log("Failed to capture screenshot: " + se.message);
    }
  } finally {
    await browser.close().catch(() => {});
    console.log("CDP connection closed.");
  }
}

run();
