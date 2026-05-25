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

        // --- Step 1: Click "Save and publish" in the confirmation popup ---
        console.log("[promote-bot] Looking for 'Save and publish' button in the center confirmation popup...");
        const popupSaveBtn = page.locator('button[debug-id="yes-button"]');
        const count = await popupSaveBtn.count();
        console.log(`[promote-bot] Found ${count} buttons matching "Save and publish" (yes-button)`);

        let clicked = false;
        if (count > 0 && await popupSaveBtn.isVisible()) {
            console.log("[promote-bot] Clicking the 'Save and publish' button inside the active dialog...");
            await popupSaveBtn.click();
            clicked = true;
        }

        if (clicked) {
            console.log("[promote-bot] Save and publish clicked. Waiting 5 seconds for save API to complete...");
            await page.waitForTimeout(5000);
        } else {
            console.log("[promote-bot] Warning: Could not click any Save and publish button.");
        }

        await page.screenshot({ path: resolve(rootDir, "contact_published_state.png") });

        // --- Step 2: Dismiss "Go to Publishing overview?" if it shows up ---
        console.log("[promote-bot] Checking for overview modal...");
        const notNowBtn = page.locator('button:has-text("Not now")').first();
        if (await notNowBtn.count() > 0 && await notNowBtn.isVisible()) {
            console.log("[promote-bot] Dismissing overview modal by clicking 'Not now'...");
            await notNowBtn.click();
            await page.waitForTimeout(2000);
        }

        // --- Step 3: Close the contact details modal if it's still open ---
        console.log("[promote-bot] Closing contact details modal...");
        const closeX = page.locator('button[debug-id="close-icon-button"]');
        const closeCount = await closeX.count();
        let closed = false;
        if (closeCount > 0 && await closeX.isVisible()) {
            console.log("[promote-bot] Clicking close icon button...");
            await closeX.click();
            closed = true;
        }
        if (!closed) {
            console.log("[promote-bot] Closing by selector fallback...");
            const firstX = page.locator('button[aria-label="Close"]').first();
            if (await firstX.count() > 0 && await firstX.isVisible()) {
                await firstX.click();
            }
        }

        await page.waitForTimeout(3000);
        console.log("[promote-bot] Completed contact details publication!");

        // Final page screenshot
        await page.screenshot({ path: resolve(rootDir, "category_contact_completed_final.png") });
        console.log("[promote-bot] Final Settings screen saved to category_contact_completed_final.png");

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
