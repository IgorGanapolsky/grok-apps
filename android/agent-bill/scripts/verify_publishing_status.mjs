import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        // Find existing AgentBill page or open a new one
        let page = pages.find((p) => p.url().includes("play.google.com/console") && p.url().includes(APP_ID));
        if (!page) {
            console.log("No AgentBill Play Console page found. Opening a new tab...");
            page = await ctx.newPage();
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        // First go to dashboard to establish the app context using domcontentloaded
        const dashboardUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-dashboard`;
        console.log(`Navigating first to App Dashboard: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(6000);

        // Now navigate to Publishing Overview
        const pubOverviewUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/publishing-overview`;
        console.log(`Navigating to Publishing Overview: ${pubOverviewUrl}`);
        await page.goto(pubOverviewUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(6000);

        const pageText = await page.evaluate(() => document.body.innerText);
        writeFileSync(resolve(rootDir, "current_publishing_overview_text.txt"), pageText);

        console.log("\n--- Publishing Overview Page Content ---");
        const lines = pageText.split("\n");
        for (const line of lines) {
            const l = line.trim();
            if (l.length > 0) {
                console.log(`  > ${l}`);
            }
        }
        console.log("----------------------------------------\n");

        const screenshotPath = resolve(rootDir, "current_publishing_overview.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        // IMPORTANT: DO NOT close the browser to keep Chrome Canary's tabs open!
        console.log("CDP client disconnected safely.");
    }
}
run();
