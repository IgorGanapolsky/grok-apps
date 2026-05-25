import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console") && p.url().includes(APP_ID));
        if (!page) {
            page = await ctx.newPage();
        }

        const targetUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/closed-testing`;
        console.log(`Navigating to Closed Testing: ${targetUrl}`);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(5000);

        console.log(`Current page title: "${await page.title()}"`);
        console.log(`Current page URL: ${page.url()}`);

        const text = await page.evaluate(() => document.body.innerText);
        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/closed_testing_text.txt", text);

        console.log("\n--- Closed Testing Track Content Snippets ---");
        const statusLines = text.split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0 && (
                line.includes("review") || 
                line.includes("Review") ||
                line.includes("Active") ||
                line.includes("active") ||
                line.includes("Version") ||
                line.includes("version") ||
                line.includes("Release") ||
                line.includes("release") ||
                line.includes("Alpha") ||
                line.includes("Testers") ||
                line.includes("testers")
            ));
        console.log(statusLines.slice(0, 30).join("\n"));
        console.log("---------------------------------------------\n");

        const screenshotPath = "/Users/igorganapolsky/.gemini/antigravity/brain/951228a6-1c75-48ef-b181-e8df8cd6f2b3/closed_testing_track_live.png";
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        console.log("CDP disconnected.");
    }
}
run();
