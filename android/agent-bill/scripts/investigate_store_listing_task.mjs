import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");

        const dashboardUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-dashboard";
        console.log(`Navigating to Dashboard: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(5000);

        // Capture screenshot
        await page.screenshot({ path: resolve(rootDir, "dashboard_after_store_save.png"), fullPage: true });
        console.log("Saved dashboard_after_store_save.png");

        // Click "Set up your store listing" task on dashboard
        console.log("Clicking 'Set up your store listing' task...");
        await page.evaluate(() => {
            const tasks = Array.from(document.querySelectorAll("div, a, span"));
            const storeTask = tasks.find(t => t.innerText && t.innerText.includes("Set up your store listing"));
            if (storeTask) {
                const clickable = storeTask.closest('a') || storeTask.closest('button') || storeTask;
                clickable.click();
            }
        });
        await page.waitForTimeout(5000);

        console.log(`Current URL after clicking task: ${page.url()}`);
        await page.screenshot({ path: resolve(rootDir, "store_listing_after_click.png"), fullPage: true });
        console.log("Saved store_listing_after_click.png");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("Disconnected.");
    }
}
run();
