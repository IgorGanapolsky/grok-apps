import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found. Opening a new one...");
            page = await ctx.newPage();
        }

        const internalTestingUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/tracks/internal-testing";
        console.log(`Navigating to Internal testing track: ${internalTestingUrl}`);
        await page.goto(internalTestingUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        console.log(`Current page title: "${await page.title()}"`);
        console.log(`Current page URL: ${page.url()}`);

        // Capture screenshot
        const screenshotPath = resolve(rootDir, "agentbill_internal_testing_track.png");
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Search for releases on the page
        const text = await page.innerText("body");
        console.log("Page includes 'Draft':", text.includes("Draft") || text.includes("draft"));
        console.log("Page includes 'Active':", text.includes("Active") || text.includes("active"));
        console.log("Page includes 'v0.1.3':", text.includes("v0.1.3") || text.includes("0.1.3"));
        console.log("Page includes 'v0.1.0':", text.includes("v0.1.0") || text.includes("0.1.0"));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("Disconnected successfully.");
    }
}
run();
