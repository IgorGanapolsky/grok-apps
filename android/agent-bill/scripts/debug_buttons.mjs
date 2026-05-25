import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("store-settings"));
        
        if (!page) {
            console.error("Error: Play Store Settings page not found.");
            return;
        }

        // Let's find all buttons and print their outerHTML and visibility
        const buttons = page.locator('button');
        const count = await buttons.count();
        console.log(`Total buttons found: ${count}`);

        for (let i = 0; i < count; i++) {
            const btn = buttons.nth(i);
            const text = await btn.innerText().catch(() => "");
            const visible = await btn.isVisible().catch(() => false);
            if (visible && text.trim().length > 0) {
                const html = await btn.evaluate(el => el.outerHTML).catch(() => "");
                console.log(`Button ${i}: visible=true, text="${text.trim()}"`);
                console.log(`  HTML: ${html.slice(0, 200)}`);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close().catch(() => {});
        console.log("CDP client disconnected.");
    }
}

run();
