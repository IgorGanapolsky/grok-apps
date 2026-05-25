import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[inspect-drawer] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // Force close any existing drawer / modal
        console.log("[inspect-drawer] Closing open drawer / modal if any...");
        await page.evaluate(() => {
            const closeButtons = Array.from(document.querySelectorAll("aside button, [role='dialog'] button, .drawer button")).filter(b => {
                const txt = b.innerText ? b.innerText.toLowerCase() : "";
                const aria = b.getAttribute("aria-label") ? b.getAttribute("aria-label").toLowerCase() : "";
                return txt.includes("close") || aria.includes("close");
            });
            closeButtons.forEach(b => b.click());
        });
        await page.waitForTimeout(2000);

        // Scroll "Phone screenshots" row into view
        console.log("[inspect-drawer] Scrolling 'Phone screenshots' row into view...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const phoneRow = rows.find(r => r.innerText && r.innerText.includes("Phone screenshots"));
            if (phoneRow) {
                phoneRow.scrollIntoView({ block: "center" });
            }
        });
        await page.waitForTimeout(1000);

        console.log("[inspect-drawer] Clicking 'Add assets' on 'Phone screenshots' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const phoneRow = rows.find(r => r.innerText && r.innerText.includes("Phone screenshots"));
            if (phoneRow) {
                // Find button with text or debug-id
                const btn = phoneRow.querySelector('button[debug-id="add-button"], button[debug-id="add-more-button"]') || phoneRow.querySelector('button');
                if (btn) btn.click();
            }
        });
        
        console.log("[inspect-drawer] Waiting 5 seconds for drawer to open...");
        await page.waitForTimeout(5000);

        // Inspect the drawer asset list rows
        const drawerAssets = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            return rows.map((row, idx) => {
                const text = row.innerText ? row.innerText.trim() : "";
                const img = row.querySelector("img");
                const selectBtn = row.querySelector('a[debug-id="select-button"], button[debug-id="select-button"]');
                return {
                    index: idx,
                    text: text.replace(/\n/g, " | "),
                    imgAlt: img ? img.getAttribute("alt") : null,
                    imgSrc: img ? img.getAttribute("src") : null,
                    hasSelectBtn: !!selectBtn,
                    selectBtnText: selectBtn ? selectBtn.innerText.trim() : ""
                };
            });
        });

        console.log("\n=================== DRAWER ASSETS ===================");
        console.log(JSON.stringify(drawerAssets, null, 2));
        console.log("=====================================================\n");

        // Take a screenshot for visual inspection
        const screenshotPath = resolve(rootDir, "drawer_feature_graphic_inspect.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[inspect-drawer] Screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("[inspect-drawer] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[inspect-drawer] CDP client disconnected safely.");
    }
}

run();
