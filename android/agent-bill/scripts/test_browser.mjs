import { chromium } from "playwright";
import { existsSync, mkdtempSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const CANARY_BIN = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const CANARY_PROFILE = "/Users/igorganapolsky/Library/Application Support/Google/Chrome Canary";

async function test() {
    try {
        execSync(`pgrep -f "Google Chrome Canary"`, { stdio: "ignore" });
        console.error("ERROR: Google Chrome Canary is already running. Please close it before running this script to use the live profile directly.");
        process.exit(1);
    } catch {}

    const ctx = await chromium.launchPersistentContext(CANARY_PROFILE, {
        headless: false,
        executablePath: CANARY_BIN,
        ignoreDefaultArgs: ["--enable-automation"],
        args: ["--disable-blink-features=AutomationControlled"],
    });
    const page = ctx.pages()[0] || (await ctx.newPage());
    console.log("Navigating to google.com...");
    await page.goto("https://www.google.com");
    await page.screenshot({ path: "test_google.png" });
    console.log("Closing...");
    await ctx.close();
}
test();
