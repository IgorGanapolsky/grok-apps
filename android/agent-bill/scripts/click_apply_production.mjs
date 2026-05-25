import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("[promote-bot] Connecting to Comet...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        
        await page.setViewportSize({ width: 1440, height: 900 });

        const dashboardUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-dashboard`;
        console.log(`[promote-bot] Navigating directly to App Dashboard: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        // Scroll to "Apply for production" button to make it visible
        console.log("[promote-bot] Scrolling to Apply for production button...");
        const applyBtn = page.locator('button[debug-id="apply-for-prod-button"]').first();
        if (await applyBtn.count() > 0) {
            await applyBtn.scrollIntoViewIfNeeded();
            await page.waitForTimeout(2000);
            
            const screenshotPath = resolve(rootDir, "dashboard_apply_visible.png");
            await page.screenshot({ path: screenshotPath });
            console.log(`[promote-bot] Screenshot of apply button saved to ${screenshotPath}`);

            const isDisabled = await applyBtn.evaluate(el => el.disabled || el.getAttribute("aria-disabled") === "true");
            console.log(`[promote-bot] Apply button disabled state: ${isDisabled}`);

            if (!isDisabled) {
                console.log("[promote-bot] Button is active! Clicking 'Apply for production'...");
                await applyBtn.click();
                await page.waitForTimeout(6000);
                
                const clickedScreenshotPath = resolve(rootDir, "dashboard_after_apply_click.png");
                await page.screenshot({ path: clickedScreenshotPath });
                console.log(`[promote-bot] Screenshot after click saved to ${clickedScreenshotPath}`);
            } else {
                console.log("[promote-bot] Cannot click Apply for production because it is disabled.");
            }
        } else {
            console.log("[promote-bot] Apply for production button not found.");
        }

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected safely.");
    }
}

run();
