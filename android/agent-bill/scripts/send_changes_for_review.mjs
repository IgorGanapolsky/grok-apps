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

        console.log("Current Page URL before sending for review:", page.url());

        // Find the "Send changes for review" button
        const sendBtn = page.locator('button:has-text("changes for review")').first();
        if (await sendBtn.count() > 0 && await sendBtn.isEnabled()) {
            const btnText = await sendBtn.innerText();
            console.log(`Found active button: "${btnText}". Clicking it now...`);
            await sendBtn.click();
            await page.waitForTimeout(6000); // Wait for modal/dialog

            // Check if there is a secondary confirmation dialog modal
            console.log("Checking for secondary confirmation dialog modal...");
            const confirmBtn = page.locator('[role="dialog"] button:has-text("Send"), [role="dialog"] button:has-text("Submit"), [role="dialog"] button:has-text("Send for review")').first();
            if (await confirmBtn.count() > 0 && await confirmBtn.isVisible()) {
                console.log(`Found confirmation button: "${await confirmBtn.innerText()}". Clicking...`);
                await confirmBtn.click();
                await page.waitForTimeout(8000); // Wait for submission
            } else {
                console.log("No secondary confirmation dialog found, or it was not visible.");
            }
        } else {
            console.log("'Send changes for review' button not found or is disabled.");
        }

        console.log("Current Page URL after sending:", page.url());
        const screenshotPath = resolve(rootDir, "alpha_sent_for_review_success.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
