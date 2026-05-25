import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const PREPARE_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/releases/internal-testing/prepare`;

async function run() {
    console.log("[inspect-prepare] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) page = await ctx.newPage();

        await page.setViewportSize({ width: 1440, height: 900 });

        console.log(`[inspect-prepare] Navigating to: ${PREPARE_URL}`);
        await page.goto(PREPARE_URL, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        const screenshotPath = resolve(rootDir, "internal_testing_prepare.png");
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[inspect-prepare] Screenshot saved to ${screenshotPath}`);

        // Analyze page
        const info = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button")).map(b => b.innerText.trim());
            const activeErrors = Array.from(document.querySelectorAll(".error, mat-error")).map(e => e.innerText.trim());
            return { title: document.title, buttons, activeErrors };
        });

        console.log("[inspect-prepare] Page Info:", JSON.stringify(info, null, 2));

    } catch (e) {
        console.error("[inspect-prepare] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[inspect-prepare] CDP client disconnected.");
    }
}

run();
