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
        
        // Extract all text that looks like a warning or error message
        const texts = await page.evaluate(() => {
            const results = [];
            // Find all error/warning classes or typical material design error selectors
            const selectors = [
                'sys-banner', 'div[role="alert"]', '.error', '.warning', 
                'span[class*="error"]', 'div[class*="error"]', 
                'span[class*="warning"]', 'div[class*="warning"]',
                'header', 'h3', 'p'
            ];
            
            selectors.forEach(sel => {
                try {
                    const elements = document.querySelectorAll(sel);
                    elements.forEach(el => {
                        const txt = el.innerText ? el.innerText.trim() : "";
                        if (txt && txt.length > 5 && txt.length < 500) {
                            if (!results.includes(txt)) {
                                results.push(`[${sel}] ${txt}`);
                            }
                        }
                    });
                } catch(e) {}
            });
            
            // Check for file upload list items
            const files = document.querySelectorAll('li, div[role="listitem"]');
            files.forEach(f => {
                const txt = f.innerText ? f.innerText.trim() : "";
                if (txt && (txt.includes(".aab") || txt.includes("Version") || txt.includes("error") || txt.includes("fail"))) {
                    results.push(`[FileItem] ${txt}`);
                }
            });

            return results;
        });
        
        console.log("\n--- DUMPED TEXT SEGMENTS FROM THE PAGE ---");
        texts.forEach(t => console.log(t));
        console.log("------------------------------------------\n");
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
