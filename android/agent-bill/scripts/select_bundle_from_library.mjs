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
        
        console.log("Finding checkbox for version code 4...");
        // Let's find rows in the dialog/modal
        const rowWith4 = page.locator('tr, [role="row"]').filter({ hasText: '4' }).first();
        if (await rowWith4.count() === 0) {
            throw new Error("Could not find row containing '4' in the library.");
        }
        
        console.log("Found row with '4':", await rowWith4.innerText());
        
        const checkbox = rowWith4.locator('input[type="checkbox"], [role="checkbox"], .mdc-checkbox').first();
        if (await checkbox.count() === 0) {
            throw new Error("Could not find checkbox inside row with '4'.");
        }
        
        console.log("Clicking the checkbox...");
        await checkbox.click();
        await page.waitForTimeout(2000);
        
        console.log("Checking if 'Add to release' button is enabled...");
        const addBtn = page.locator('button:has-text("Add to release")').first();
        if (await addBtn.count() === 0) {
            throw new Error("Could not find 'Add to release' button.");
        }
        
        console.log("Clicking 'Add to release' button...");
        await addBtn.click();
        await page.waitForTimeout(5000);
        
        const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/bundle_added_page.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Analyze page status
        const analysis = await page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim());
            const textContent = document.body.innerText;
            const hasBundle = textContent.includes("Version code 4") || textContent.includes("0.1.3");
            const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText ? b.innerText.trim() : "");
            return { headings, hasBundle, buttons };
        });
        console.log("Headings on page:", analysis.headings);
        console.log("Does the page show version 4 bundle added?", analysis.hasBundle);
        console.log("Buttons on page:", analysis.buttons);
        
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
