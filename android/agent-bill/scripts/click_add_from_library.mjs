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
        
        console.log("Clicking 'Add from library' button...");
        const addBtn = page.locator('button:has-text("Add from library")').first();
        if (await addBtn.count() === 0) {
            throw new Error("Could not find 'Add from library' button.");
        }
        
        await addBtn.click();
        console.log("Clicked! Waiting 5 seconds for library modal/drawer to load...");
        await page.waitForTimeout(5000);
        
        const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/library_modal.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Analyze elements inside the modal/drawer
        const analysis = await page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, [role="dialog"] h2, .drawer-title')).map(h => h.innerText.trim());
            
            // Look for table rows or checkboxes/radio buttons inside the modal/drawer
            const rows = Array.from(document.querySelectorAll('tr, [role="row"]')).map(r => r.innerText ? r.innerText.trim().replace(/\n/g, ' | ') : "");
            
            const buttons = Array.from(document.querySelectorAll('button, [role="dialog"] button')).map(b => b.innerText ? b.innerText.trim() : "");
            
            return { headings, rows, buttons };
        });
        
        console.log("Headings found:", analysis.headings);
        console.log("Rows found:", analysis.rows.filter(r => r));
        console.log("Buttons found:", analysis.buttons);
        
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
