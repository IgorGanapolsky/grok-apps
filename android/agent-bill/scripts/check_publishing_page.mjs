import { chromium } from "playwright";
import { resolve } from "node:path";
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
        
        // Find existing tab or open a new one
        let page = pages.find((p) => p.url().includes("play.google.com/console") && p.url().includes(APP_ID) && p.url().includes("/publishing"));
        if (!page) {
            console.log("No active publishing page tab found, finding any Play Console app tab...");
            page = pages.find((p) => p.url().includes("play.google.com/console") && p.url().includes(APP_ID));
        }
        
        if (!page) {
            console.log("No Play Console tab found for this app. Opening a new tab...");
            page = await ctx.newPage();
        }

        const targetUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/publishing`;
        console.log(`Navigating to Publishing: ${targetUrl}`);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(5000);

        console.log(`Current page title: "${await page.title()}"`);
        console.log(`Current page URL: ${page.url()}`);

        const text = await page.evaluate(() => document.body.innerText);
        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/publishing_page_text.txt", text);

        // Find status indicator text
        console.log("\n--- Publishing Overview Status Text ---");
        const statusLines = text.split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0 && (
                line.includes("review") || 
                line.includes("Review") || 
                line.includes("Publish") || 
                line.includes("publish") || 
                line.includes("changes") || 
                line.includes("Changes") ||
                line.includes("Live") ||
                line.includes("live") ||
                line.includes("Closed testing")
            ));
        console.log(statusLines.slice(0, 30).join("\n"));
        console.log("----------------------------------------\n");

        const screenshotPath = "/Users/igorganapolsky/.gemini/antigravity/brain/951228a6-1c75-48ef-b181-e8df8cd6f2b3/publishing_live_check.png";
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        console.log("CDP disconnected.");
    }
}
run();
