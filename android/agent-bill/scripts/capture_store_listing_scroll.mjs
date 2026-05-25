import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const STORE_LISTING_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/main-store-listing`;

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found. Opening a new tab...");
            page = await ctx.newPage();
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        console.log(`Navigating to: ${STORE_LISTING_URL}`);
        await page.goto(STORE_LISTING_URL, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        // Scroll to Graphics section
        console.log("Scrolling down to Graphics section...");
        await page.evaluate(() => {
            const h2 = Array.from(document.querySelectorAll("h2")).find(h => h.innerText.includes("Graphics"));
            if (h2) h2.scrollIntoView();
        });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: resolve(rootDir, "store_listing_scroll_graphics.png") });

        // Scroll further down
        console.log("Scrolling down to Tablet section...");
        await page.evaluate(() => {
            const label = Array.from(document.querySelectorAll("div, h3, h4, span")).find(el => el.innerText.includes("7-inch tablet"));
            if (label) label.scrollIntoView();
        });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: resolve(rootDir, "store_listing_scroll_tablet.png") });

        // Scroll all the way down
        console.log("Scrolling to the bottom...");
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: resolve(rootDir, "store_listing_scroll_bottom.png") });

        // Analyze which rows have uploaded assets and count them
        const rowsInfo = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            return rows.map(row => {
                const label = row.querySelector(".row-title, h3, [class*='label'], [class*='title']")?.innerText || row.innerText.split("\n")[0];
                const appliedAssets = Array.from(row.querySelectorAll("img, video, [class*='thumbnail']")).length;
                const fileInputs = Array.from(row.querySelectorAll("input[type='file']")).length;
                const deleteBtns = Array.from(row.querySelectorAll('button[debug-id="delete-button"]')).length;
                return { label: label.trim(), appliedAssets, fileInputs, deleteBtns };
            });
        });
        console.log("Rows Info:", JSON.stringify(rowsInfo, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("CDP client disconnected safely.");
    }
}

run();
