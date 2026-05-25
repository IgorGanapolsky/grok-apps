import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found.");
            return;
        }
        console.log(`Current page URL: ${page.url()}`);
        
        console.log("Clicking 'Manage track' button next to Alpha...");
        const manageTrackBtn = page.locator('button[aria-label*="Manage Closed testing - Alpha track"], button:has-text("Manage track")').first();
        if (await manageTrackBtn.count() === 0) {
            throw new Error("Could not find 'Manage track' button.");
        }
        
        await manageTrackBtn.click();
        console.log("Clicked! Waiting 8 seconds for navigation/rendering...");
        await page.waitForTimeout(8000);
        
        console.log(`New page URL: ${page.url()}`);
        console.log(`New page Title: ${await page.title()}`);
        
        const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/alpha_track_page.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Check the headings and buttons on the new page
        const analysis = await page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim());
            const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText ? b.innerText.trim() : "");
            const links = Array.from(document.querySelectorAll('a')).map(a => a.innerText ? a.innerText.trim() : "");
            return { headings, buttons, links };
        });
        console.log("Headings on new page:", analysis.headings);
        console.log("Buttons on new page:", analysis.buttons);
        console.log("Links on new page:", analysis.links);
        
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
