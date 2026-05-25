import { chromium } from "playwright";

async function run() {
    console.log("[find-files] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        console.log(`[find-files] Active page title: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        const locator = page.locator('input[type="file"]');
        const count = await locator.count();
        console.log(`[find-files] Found ${count} input[type="file"] elements using Playwright global locator (shadow-piercing).`);

        for (let i = 0; i < count; i++) {
            const el = locator.nth(i);
            const outerHTML = await el.evaluate(node => node.outerHTML);
            console.log(`  Input #${i}: ${outerHTML}`);
        }

    } catch (e) {
        console.error("[find-files] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[find-files] CDP client disconnected.");
    }
}

run();
