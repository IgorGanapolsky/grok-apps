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

        console.log("Opening Feature graphic drawer...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const targetRow = rows.find(r => r.innerText && /Feature graphic/i.test(r.innerText));
            if (targetRow) {
                const btn = targetRow.querySelector("button");
                if (btn) btn.click();
            }
        });
        await page.waitForTimeout(4000);

        const rowsData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            return rows.map((r, i) => ({
                index: i,
                innerText: r.innerText || "",
                html: r.innerHTML.substring(0, 300)
            }));
        });

        console.log(`Found ${rowsData.length} rows in the drawer:`);
        console.log(JSON.stringify(rowsData, null, 2));

        console.log("Closing drawer...");
        const closeBtn = page.locator('material-drawer button[debug-id="close-button"]').first();
        if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
            await closeBtn.click();
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
