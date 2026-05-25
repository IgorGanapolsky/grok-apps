import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP...");
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

        console.log(`Analyzing tab: "${await page.title()}"`);

        // Find and map app bundle cards to their delete buttons
        const bundlesMap = await page.evaluate(() => {
            const results = [];
            // Google Play Console typical row or list item selector for uploaded app bundles
            const items = document.querySelectorAll('li, div[role="listitem"], .release-bundle-row, tr');
            
            items.forEach((item, idx) => {
                const text = item.innerText ? item.innerText.trim() : "";
                if (text && (text.includes("App bundle:") || text.includes("Version") || text.includes(".aab"))) {
                    // Find all buttons inside this item
                    const buttons = item.querySelectorAll('button');
                    const btnDetails = Array.from(buttons).map(b => ({
                        text: b.innerText ? b.innerText.trim() : "",
                        ariaLabel: b.getAttribute('aria-label') || "",
                        disabled: b.disabled || false,
                        class: b.className || ""
                    }));
                    
                    results.push({
                        itemIndex: idx,
                        text: text.substring(0, 300), // first 300 chars of item text
                        buttons: btnDetails
                    });
                }
            });
            return results;
        });

        console.log("\n--- UPLOADED APP BUNDLES & ACTIONS ---");
        bundlesMap.forEach((b, idx) => {
            console.log(`\nBundle Row #${idx} (Item Index: ${b.itemIndex}):`);
            console.log(`Text Summary: ${b.text.replace(/\n/g, " | ")}`);
            console.log(`Actions inside this row:`);
            b.buttons.forEach((btn, bIdx) => {
                console.log(`  Action #${bIdx}: Text="${btn.text}", AriaLabel="${btn.ariaLabel}", Disabled=${btn.disabled}, Class="${btn.class}"`);
            });
        });
        console.log("\n---------------------------------------\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
