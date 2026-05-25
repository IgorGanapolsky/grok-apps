import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const INTERNAL_TESTING_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/tracks/internal-testing`;

async function run() {
    console.log("[promote-details] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) page = await ctx.newPage();

        await page.setViewportSize({ width: 1440, height: 900 });

        console.log(`[promote-details] Navigating to: ${INTERNAL_TESTING_URL}`);
        await page.goto(INTERNAL_TESTING_URL, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        console.log("[promote-details] Clicking 'Promote release' button...");
        const promoteBtn = page.locator('button:has-text("Promote release")').first();
        await promoteBtn.click();
        await page.waitForTimeout(2000);

        // Hover over the Production menu item to trigger tooltip
        console.log("[promote-details] Hovering over 'Production' item...");
        const productionItem = page.locator('material-select-item:has-text("Production")').first();
        if (await productionItem.count() > 0) {
            await productionItem.hover();
            await page.waitForTimeout(3000);
            
            await page.screenshot({ path: resolve(rootDir, "promote_production_hover.png") });
            console.log("[promote-details] Saved screenshot for production hover.");
            
            // Extract tooltip text
            const tooltips = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('material-tooltip-card, [role="tooltip"], .tooltip, .material-tooltip, [debug-id*="tooltip"]'))
                    .map(el => el.innerText ? el.innerText.trim() : "");
            });
            console.log("[promote-details] Tooltips visible:", tooltips);
        }

        // Now let's hover over "Closed testing" to see if we can promote there
        console.log("[promote-details] Hovering over 'Closed testing' item...");
        const closedItem = page.locator('material-select-item:has-text("Closed testing")').first();
        if (await closedItem.count() > 0) {
            await closedItem.hover();
            await page.waitForTimeout(3000);
            
            await page.screenshot({ path: resolve(rootDir, "promote_closed_hover.png") });
            console.log("[promote-details] Saved screenshot for closed testing hover.");
            
            // Extract visible items
            const closedSubmenu = await page.evaluate(() => {
                const submenus = Array.from(document.querySelectorAll('.popup-content, .submenu, [role="menu"]'));
                return submenus.map(el => el.innerText ? el.innerText.trim().replace(/\n/g, " | ") : "");
            });
            console.log("[promote-details] Submenu/popup contents:", closedSubmenu);
        }

    } catch (e) {
        console.error("[promote-details] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-details] CDP client disconnected.");
    }
}

run();
