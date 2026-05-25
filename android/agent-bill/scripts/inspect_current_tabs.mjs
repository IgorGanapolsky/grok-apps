import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        console.log(`Found ${contexts.length} contexts.`);
        for (let i = 0; i < contexts.length; i++) {
            const pages = await contexts[i].pages();
            console.log(`Context ${i} has ${pages.length} pages:`);
            for (let j = 0; j < pages.length; j++) {
                const page = pages[j];
                console.log(`  Page ${j}: URL = "${page.url()}", Title = "${await page.title()}"`);
            }
        }
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        // IMPORTANT: DO NOT call browser.close() to keep the tabs alive in Chrome Canary!
        console.log("CDP client disconnected safely without closing the browser.");
    }
}
run();
