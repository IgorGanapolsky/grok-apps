import { chromium } from "playwright";
import { existsSync, homedir } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const CANARY_BIN = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const CANARY_PROFILE = join(homedir(), "Library", "Application Support", "Google", "Chrome Canary");

try {
  execSync(`pgrep -f "Google Chrome Canary"`, { stdio: "ignore" });
  console.error("ERROR: Google Chrome Canary is already running. Please close it before running this script to use the live profile directly.");
  process.exit(1);
} catch (err) {
  // Not running
}

const ctx = await chromium.launchPersistentContext(CANARY_PROFILE, {
  headless: false,
  executablePath: CANARY_BIN,
  viewport: { width: 1440, height: 900 },
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"],
});

const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto("https://play.google.com/console/u/0/developers/5569424694437250668/apps-list", { waitUntil: "networkidle" });
await page.screenshot({ path: "play_console_screenshot.png" });
const content = await page.textContent("body");
console.log("Page includes AgentBill:", content.includes("AgentBill"));
await ctx.close();
