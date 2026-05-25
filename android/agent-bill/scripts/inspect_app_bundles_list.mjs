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

        // Find all buttons on the page to see if there are delete or close buttons
        const buttons = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            return Array.from(btns).map(b => ({
                text: b.innerText ? b.innerText.trim() : "",
                ariaLabel: b.getAttribute('aria-label') || "",
                class: b.className || "",
                disabled: b.disabled || false,
                id: b.id || ""
            }));
        });

        console.log("\n--- BUTTONS LIST ---");
        buttons.forEach((b, idx) => {
            if (b.text || b.ariaLabel) {
                console.log(`Button #${idx}: Text="${b.text}", AriaLabel="${b.ariaLabel}", Disabled=${b.disabled}, ID="${b.id}", Class="${b.class}"`);
            }
        });
        console.log("--------------------\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
