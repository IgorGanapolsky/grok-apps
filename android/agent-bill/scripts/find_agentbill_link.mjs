import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found. Opening a new one...");
            page = await ctx.newPage();
        }

        const url = "https://play.google.com/console/u/0/developers/8239620436488925047/app-list";
        console.log(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
        console.log("Waiting 15 seconds for app list to fully render...");
        await page.waitForTimeout(15000);

        // Find rows and associate text with links
        const rowMappings = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tr'));
            return rows.map((row, idx) => {
                const text = row.innerText.trim();
                const link = row.querySelector('a[href*="/app/"]');
                return {
                    index: idx,
                    text: text.replace(/\n/g, ' | '),
                    href: link ? link.href : null
                };
            }).filter(r => r.text.length > 0);
        });

        console.log("Row Mappings (App Name & URL):");
        console.log(JSON.stringify(rowMappings, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("Disconnected successfully.");
    }
}
run();
