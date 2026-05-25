import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            page = await ctx.newPage();
        }

        const appListUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app-list";
        console.log(`Navigating to App List: ${appListUrl}`);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(appListUrl, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(5000);

        console.log("Locating AgentBill — AI Cost Auditor row...");
        // Let's find the row that has 'com.iganapolsky.agentbill' and click its 'View app' link
        const clickSuccess = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tr'));
            const targetRow = rows.find(row => row.innerText && row.innerText.includes("com.iganapolsky.agentbill"));
            if (targetRow) {
                const viewAppLink = targetRow.querySelector('a');
                if (viewAppLink) {
                    viewAppLink.click();
                    return true;
                }
            }
            return false;
        });

        if (clickSuccess) {
            console.log("Successfully clicked 'View app' link. Waiting for navigation...");
            await page.waitForTimeout(6000);
            console.log(`New URL: ${page.url()}`);
            console.log(`New Title: "${await page.title()}"`);

            // Let's take a screenshot
            const screenshotPath = "/Users/igorganapolsky/.gemini/antigravity/brain/951228a6-1c75-48ef-b181-e8df8cd6f2b3/agentbill_navigated_dashboard.png";
            await page.screenshot({ path: screenshotPath });
            console.log(`Screenshot saved to ${screenshotPath}`);
        } else {
            console.log("Failed to locate target row or 'View app' link.");
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        console.log("CDP disconnected.");
    }
}
run();
