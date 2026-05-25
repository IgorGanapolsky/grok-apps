import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found.");
            return;
        }

        console.log("Finding Financial features card...");
        
        // Find all possible section-like containers
        const containers = page.locator('div, section, tr, li, [role="listitem"]');
        const count = await containers.count();
        console.log(`Total containers on page: ${count}`);

        // Let's find containers that contain "Financial features"
        const financialContainers = containers.filter({ hasText: /Financial features/i });
        const matchCount = await financialContainers.count();
        console.log(`Matching containers for Financial features: ${matchCount}`);

        for (let i = 0; i < matchCount; i++) {
            const text = await financialContainers.nth(i).innerText();
            console.log(`Match #${i}: Length=${text.length}, text preview: "${text.substring(0, 100).replace(/\n/g, ' ')}"`);
            
            // Check for buttons in this container
            const btns = financialContainers.nth(i).locator('button, a');
            const btnCount = await btns.count();
            console.log(`  Buttons inside container #${i}: ${btnCount}`);
            for (let j = 0; j < btnCount; j++) {
                const btnText = await btns.nth(j).innerText();
                console.log(`    Btn #${j}: "${btnText.replace(/\n/g, ' ')}"`);
            }
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
