import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        console.log(`Found ${contexts.length} contexts`);
        for (const [ctxIdx, ctx] of contexts.entries()) {
            const pages = await ctx.pages();
            console.log(`Context #${ctxIdx}: ${pages.length} pages`);
            for (const [pageIdx, page] of pages.entries()) {
                const url = page.url();
                let title = "Skipped title";
                try {
                    // Try to get title with a fast timeout (2s)
                    title = await Promise.race([
                        page.title(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
                    ]);
                } catch (e) {
                    title = `Error/Timeout getting title: ${e.message}`;
                }
                console.log(`  Page #${pageIdx}: "${title}" -> ${url}`);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
