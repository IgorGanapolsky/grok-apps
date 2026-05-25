import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[promote-bot] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("store-settings"));
        
        if (!page) {
            console.error("Error: Play Store Settings page not found.");
            return;
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        // Let's find the visible close button inside the modal
        const closeX = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button:has-text("close"), button:has-text("close")');
        const count = await closeX.count();
        console.log(`[promote-bot] Found ${count} close buttons.`);

        let clicked = false;
        for (let i = 0; i < count; i++) {
            const btn = closeX.nth(i);
            if (await btn.isVisible()) {
                console.log(`[promote-bot] Clicking visible close button at index ${i}...`);
                await btn.click();
                clicked = true;
                break;
            }
        }

        if (!clicked) {
            console.log("[promote-bot] No visible close button found in list. Attempting to click by selector...");
            await page.locator('button[aria-label="Close"]').first().click();
        }

        console.log("[promote-bot] Waiting 3 seconds for modal to close...");
        await page.waitForTimeout(3000);

        await page.screenshot({ path: resolve(rootDir, "modal_closed_success.png") });
        console.log("[promote-bot] Screenshot saved as modal_closed_success.png");

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
