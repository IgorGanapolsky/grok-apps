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

        console.log("Page URL:", page.url());

        // Step 1: Click "Edit release" next to version 4 (0.1.3)
        console.log("Searching for 'Edit release' button/link...");
        const clickedEdit = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('a, button'));
            const editBtn = buttons.find(b => {
                const text = b.innerText ? b.innerText.trim() : "";
                return text === "Edit release";
            });
            if (editBtn) {
                editBtn.click();
                return true;
            }
            return false;
        });

        if (!clickedEdit) {
            console.log("'Edit release' button not found via evaluation. Trying locator...");
            const editLocator = page.locator('button:has-text("Edit release"), a:has-text("Edit release")').first();
            if (await editLocator.count() > 0) {
                await editLocator.click();
                console.log("Clicked 'Edit release' via locator.");
            } else {
                throw new Error("Could not find 'Edit release' button.");
            }
        } else {
            console.log("Clicked 'Edit release' via page evaluate.");
        }

        console.log("Waiting for release editor page to load...");
        await page.waitForTimeout(6000);

        const editScreenshotPath = resolve(rootDir, "alpha_edit_release_page.png");
        await page.screenshot({ path: editScreenshotPath });
        console.log(`Screenshot saved to ${editScreenshotPath}`);

        // Step 2: Look for Save button and click it if active
        console.log("Checking for 'Save' button in release editor...");
        const saveBtn = page.locator('button:has-text("Save")').last();
        if (await saveBtn.count() > 0 && await saveBtn.isEnabled()) {
            console.log("Clicking 'Save' button inside editor...");
            await saveBtn.click();
            await page.waitForTimeout(4000);
        } else {
            console.log("'Save' button not enabled or not found. Skipping directly to Next...");
        }

        // Step 3: Click "Next" or "Review release"
        console.log("Searching for 'Next' button...");
        const nextBtn = page.locator('button:has-text("Next")').last();
        if (await nextBtn.count() > 0) {
            console.log("Clicking 'Next' button...");
            await nextBtn.click();
            await page.waitForTimeout(8000);
        } else {
            const reviewBtn = page.locator('button:has-text("Review release")').last();
            if (await reviewBtn.count() > 0) {
                console.log("Clicking 'Review release' button...");
                await reviewBtn.click();
                await page.waitForTimeout(8000);
            } else {
                throw new Error("Could not find 'Next' or 'Review release' button.");
            }
        }

        const reviewScreenshotPath = resolve(rootDir, "alpha_review_release_page.png");
        await page.screenshot({ path: reviewScreenshotPath });
        console.log(`Review page screenshot saved to ${reviewScreenshotPath}`);

        // Step 4: Click "Start rollout to Closed testing - Alpha"
        console.log("Searching for 'Start rollout' button on review page...");
        const rolloutBtn = page.locator('button:has-text("Start rollout"), button:has-text("rollout"), button:has-text("Rollout")').first();
        if (await rolloutBtn.count() > 0 && await rolloutBtn.isEnabled()) {
            console.log("Clicking 'Start rollout' button...");
            await rolloutBtn.click();
            await page.waitForTimeout(4000);

            // Handle secondary confirmation dialog
            console.log("Checking for secondary confirmation dialog...");
            const confirmBtn = page.locator('[role="dialog"] button:has-text("Rollout"), [role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Publish")').first();
            if (await confirmBtn.count() > 0 && await confirmBtn.isVisible()) {
                console.log("Found confirmation button inside dialog, clicking...");
                await confirmBtn.click();
                await page.waitForTimeout(8000);
            } else {
                console.log("No secondary confirmation dialog found, or it was not visible.");
            }
        } else {
            console.log("Rollout button not found or not enabled.");
        }

        const finalScreenshotPath = resolve(rootDir, "alpha_final_rollout_success.png");
        await page.screenshot({ path: finalScreenshotPath });
        console.log(`Final rollout screenshot saved to ${finalScreenshotPath}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
