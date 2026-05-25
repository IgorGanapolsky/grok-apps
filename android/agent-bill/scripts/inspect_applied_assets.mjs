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

        console.log(`Checking applied assets on page: "${await page.title()}"`);
        
        const assetsInfo = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            return rows.map(row => {
                const label = row.querySelector("label")?.innerText || "Unknown label";
                const thumbnails = Array.from(row.querySelectorAll("img")).map(img => img.src || "");
                const hintText = row.querySelector(".hint-text")?.innerText || "";
                const countSpan = row.querySelector(".assets-counter")?.innerText || "";
                return {
                    label: label.trim().replace(/\n/g, " "),
                    thumbnailsCount: thumbnails.length,
                    thumbnails: thumbnails.map(t => t.substring(0, 100)),
                    hintText: hintText.trim(),
                    countSpan: countSpan.trim()
                };
            });
        });

        console.log("Applied Assets Information:", JSON.stringify(assetsInfo, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
