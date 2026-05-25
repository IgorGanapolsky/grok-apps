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
        let page = pages.find((p) => p.url().includes("developers/8239620436488925047/app/4973243580627455820"));
        
        if (!page) {
            console.error("Error: Active App page not found. Creating a new page context...");
            page = await ctx.newPage();
        }

        const dashboardUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-dashboard";
        console.log(`Navigating to Dashboard URL: ${dashboardUrl}...`);
        await page.goto(dashboardUrl);
        await page.waitForTimeout(5000);

        console.log("Analyzing Dashboard elements...");
        // Let's capture the screenshot to visually inspect the completed tasks list
        await page.screenshot({ path: resolve(rootDir, "verify_app_dashboard.png") });
        console.log("Saved dashboard screenshot to verify_app_dashboard.png");

        // Let's list some text from the dashboard to check if the set up app tasks are complete
        const headings = await page.locator('h1, h2, h3').allTextContents();
        console.log("Headings found on Dashboard:", headings);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close().catch(() => {});
        console.log("CDP client disconnected.");
    }
}

run();
