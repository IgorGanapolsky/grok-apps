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

        const details = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && /App icon/i.test(r.innerText));
            if (row) {
                const elements = Array.from(row.querySelectorAll("button, [role='button'], a"));
                return elements.map(el => ({
                    tagName: el.tagName,
                    outerHTML: el.outerHTML,
                    innerText: el.innerText
                }));
            }
            return "No App icon row found";
        });

        console.log("App icon buttons:", JSON.stringify(details, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
