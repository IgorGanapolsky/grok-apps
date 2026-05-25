import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

        console.log("Current Page URL before click:", page.url());

        // Click Save button (primary action button)
        const mainButton = page.locator('button[debug-id="main-button"]').first();
        if (await mainButton.count() > 0 && await mainButton.isEnabled()) {
            console.log("Clicking primary action button ('Save' / 'Start rollout')...");
            await mainButton.click();
            await page.waitForTimeout(6000);

            // Check if there is a secondary confirmation dialog modal
            console.log("Checking for secondary confirmation dialog...");
            const dialogConfirmBtn = page.locator('[role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Rollout"), [role="dialog"] button:has-text("Publish")').first();
            if (await dialogConfirmBtn.count() > 0 && await dialogConfirmBtn.isVisible()) {
                console.log("Confirmation dialog button found! Clicking...");
                await dialogConfirmBtn.click();
                await page.waitForTimeout(6000);
            } else {
                console.log("No visible confirmation dialog found.");
            }
        } else {
            console.log("Primary action button ('Save') is either not found or disabled.");
        }

        console.log("Current Page URL after click:", page.url());
        const screenshotPath = resolve(rootDir, "alpha_save_release_success.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
