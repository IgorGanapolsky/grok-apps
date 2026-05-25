import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
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

        // Close drawer if open first
        console.log("Closing drawer first...");
        const closeBtn = page.locator('material-drawer button[debug-id="close-button"]').first();
        if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(2000);
        }

        // Open Phone screenshots drawer
        console.log("Opening Phone screenshots drawer...");
        const rowLocator = page.locator('console-form-row').filter({ hasText: /Phone screenshots/i });
        const addBtnLocator = rowLocator.locator('button[debug-id="add-button"]');
        if (await addBtnLocator.count() > 0) {
            await addBtnLocator.click();
        } else {
            console.log("Falling back to first button in row");
            await rowLocator.locator('button').first().click();
        }
        await page.waitForTimeout(5000);

        // Dump row data
        const rowsData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            return rows.map((r, i) => ({
                index: i,
                innerText: r.innerText || "",
                html: r.innerHTML.substring(0, 1000)
            }));
        });

        console.log(`Found ${rowsData.length} rows in the drawer.`);
        fs.writeFileSync(resolve(rootDir, "scratch/drawer_rows.json"), JSON.stringify(rowsData, null, 2));
        console.log("Saved to scratch/drawer_rows.json");

        // Close drawer
        console.log("Closing drawer...");
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
