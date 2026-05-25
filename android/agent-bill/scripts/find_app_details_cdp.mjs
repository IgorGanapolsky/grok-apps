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

        const dashboardUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/com.iganapolsky.agentbill/app-dashboard";
        console.log(`Navigating to: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(8000);

        console.log(`Current page title: "${await page.title()}"`);
        console.log(`Current page URL: ${page.url()}`);

        // Capture screenshot
        const screenshotPath = resolve(rootDir, "agentbill_package_dashboard_state.png");
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Extract some dashboard task text
        const text = await page.innerText("body");
        console.log("Page includes '11 of 11 completed':", text.includes("11 of 11 completed"));
        console.log("Page includes '11/11':", text.includes("11/11"));
        console.log("Page includes 'Closed testing':", text.includes("Closed testing"));
        console.log("Page includes 'Internal testing':", text.includes("Internal testing"));
        console.log("Page includes 'Production':", text.includes("Production"));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("Disconnected successfully.");
    }
}
run();
