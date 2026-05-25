import { chromium } from "playwright";

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("[promote-bot] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        console.log("[promote-bot] Opening a new tab to restore Play Console...");
        const page = await ctx.newPage();
        
        const dashboardUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-dashboard`;
        console.log(`[promote-bot] Navigating to: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);
        
        console.log(`[promote-bot] Page title: ${await page.title()}`);
        console.log(`[promote-bot] Page URL: ${page.url()}`);
        
    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected safely.");
    }
}

run();
