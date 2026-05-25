import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const page = await ctx.newPage();
        
        const closedTestingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/closed-testing`;
        console.log(`Navigating to Closed Testing: ${closedTestingUrl}`);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(closedTestingUrl, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(5000);

        console.log("Clicking 'Manage track'...");
        await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a, button'));
            const manageLink = links.find(l => l.innerText && l.innerText.includes("Manage track"));
            if (manageLink) manageLink.click();
        });
        await page.waitForTimeout(6000);
        console.log(`Navigated to: ${page.url()}`);

        // Take a screenshot of the Releases tab
        let screenshotPath = "/Users/igorganapolsky/.gemini/antigravity/brain/951228a6-1c75-48ef-b181-e8df8cd6f2b3/alpha_releases_tab.png";
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Click on the 'Testers' tab
        console.log("Clicking 'Testers' tab...");
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('[role="tab"], button, a'));
            const testersTab = tabs.find(t => t.innerText && t.innerText.includes("Testers"));
            if (testersTab) testersTab.click();
        });
        await page.waitForTimeout(5000);
        console.log("Testers tab loaded.");

        // Print page text related to testers
        const text = await page.evaluate(() => document.body.innerText);
        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/testers_tab_text.txt", text);

        console.log("\n--- Testers Configuration Details ---");
        const testerLines = text.split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0 && (
                line.includes("testers") || 
                line.includes("Testers") ||
                line.includes("group") || 
                line.includes("Group") ||
                line.includes("email") ||
                line.includes("Email") ||
                line.includes("agentbill-testers") ||
                line.includes("join") ||
                line.includes("Join") ||
                line.includes("link") ||
                line.includes("Link") ||
                line.includes("feedback") ||
                line.includes("Feedback")
            ));
        console.log(testerLines.slice(0, 40).join("\n"));
        console.log("-------------------------------------\n");

        screenshotPath = "/Users/igorganapolsky/.gemini/antigravity/brain/951228a6-1c75-48ef-b181-e8df8cd6f2b3/alpha_testers_tab.png";
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        await page.close();

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        console.log("CDP disconnected.");
    }
}
run();
