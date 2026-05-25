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

        console.log("Found page:", await page.title());

        // Check if the "Go to Publishing overview?" modal is open by looking for a button with text "Not now"
        console.log("Checking for 'Not now' button...");
        const notNowBtn = page.locator('button:has-text("Not now")');
        const exists = await notNowBtn.count();
        if (exists > 0) {
            console.log("Found 'Not now' button, clicking it...");
            await notNowBtn.click();
            await page.waitForTimeout(2000);
            console.log("Clicked 'Not now' button.");
        } else {
            console.log("'Not now' button not found.");
        }

        // Now let's see if the "Save" button at the bottom right is present and enabled
        console.log("Checking for active 'Save' button at bottom right...");
        const saveBtn = page.locator('button:has-text("Save")').filter({ has: page.locator('span') }).or(page.locator('button:has-text("Save")')).last();
        const saveBtnExists = await saveBtn.count();
        if (saveBtnExists > 0) {
            const isEnabled = await saveBtn.isEnabled();
            console.log(`Save button exists. Enabled: ${isEnabled}`);
            if (isEnabled) {
                console.log("Clicking Save button at bottom right...");
                await saveBtn.click();
                await page.waitForTimeout(3000);
            }
        } else {
            console.log("Save button not found at bottom right.");
        }

        const afterDismissScreenshot = resolve(rootDir, "dismiss_modal_and_saved.png");
        await page.screenshot({ path: afterDismissScreenshot });
        console.log(`Screenshot after dismissing modal and saving: ${afterDismissScreenshot}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
