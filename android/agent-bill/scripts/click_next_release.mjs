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
        
        console.log("Checking for 'Next' button...");
        const nextBtn = page.locator('button:has-text("Next")').first();
        if (await nextBtn.count() === 0) {
            throw new Error("Could not find 'Next' button.");
        }
        
        console.log("Clicking 'Next' button...");
        await nextBtn.click();
        console.log("Clicked! Waiting 8 seconds for the next step/errors to render...");
        await page.waitForTimeout(8000);
        
        console.log(`New page URL: ${page.url()}`);
        console.log(`New page Title: ${await page.title()}`);
        
        const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/release_preview_page.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Analyze page status (check for errors or warnings)
        const analysis = await page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim());
            const textContent = document.body.innerText;
            const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText ? b.innerText.trim() : "");
            
            // Check for error/warning cards
            const errorCards = Array.from(document.querySelectorAll('.error, mat-error, [role="alert"], .validation-error')).map(e => e.innerText.trim());
            
            return { headings, buttons, errorCards, textContentLength: textContent.length };
        });
        
        console.log("Headings on page:", analysis.headings);
        console.log("Buttons on page:", analysis.buttons);
        console.log("Error/warning cards found:", analysis.errorCards.filter(Boolean));
        
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
