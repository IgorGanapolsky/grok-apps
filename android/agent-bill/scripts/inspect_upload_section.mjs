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

        // Check for any text in "App bundles" section
        const sectionText = await page.evaluate(() => {
            const el = document.body;
            return el ? el.innerText : "";
        });

        console.log("\n--- FULL PAGE TEXT SEARCH ---");
        // Print lines containing "App bundle", "Version", "AAB", "Error", "Upload"
        const lines = sectionText.split("\n");
        lines.forEach(line => {
            const l = line.toLowerCase();
            if (l.includes("bundle") || l.includes("version") || l.includes("error") || l.includes("upload") || l.includes("save") || l.includes("draft") || l.includes("discard")) {
                console.log(`> ${line.trim()}`);
            }
        });
        console.log("-----------------------------\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
