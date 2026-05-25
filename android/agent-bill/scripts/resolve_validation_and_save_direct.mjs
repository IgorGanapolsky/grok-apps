import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[direct-resolver] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            throw new Error("No Play Console tab found.");
        }

        console.log(`[direct-resolver] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Surgically inject Release Name and Release Notes with browser-native events
        console.log("[direct-resolver] Ingesting form data natively...");
        await page.evaluate(() => {
            const releaseNameInput = document.querySelector('input[aria-label="Release name"]');
            if (releaseNameInput) {
                releaseNameInput.value = "3 (0.1.2)";
                releaseNameInput.dispatchEvent(new Event('input', { bubbles: true }));
                releaseNameInput.dispatchEvent(new Event('change', { bubbles: true }));
                releaseNameInput.dispatchEvent(new Event('blur', { bubbles: true }));
                console.log("[browser-eval] Successfully updated Release name.");
            } else {
                console.log("[browser-eval] Release name input not found.");
            }

            const releaseNotesTextarea = document.querySelector('textarea[aria-label="Release notes"]');
            if (releaseNotesTextarea) {
                releaseNotesTextarea.value = "<en-US>AgentBill v0.1.2 — Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.</en-US>";
                releaseNotesTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                releaseNotesTextarea.dispatchEvent(new Event('change', { bubbles: true }));
                releaseNotesTextarea.dispatchEvent(new Event('blur', { bubbles: true }));
                console.log("[browser-eval] Successfully updated Release notes.");
            } else {
                console.log("[browser-eval] Release notes textarea not found.");
            }
        });

        console.log("[direct-resolver] Inputs set. Waiting 4s for validator to clear...");
        await page.waitForTimeout(4000);

        // Take validation state screenshot
        const valScreenshot = resolve(rootDir, "current_tab_direct_cleared.png");
        await page.screenshot({ path: valScreenshot });
        console.log(`[direct-resolver] Saved validation cleared screenshot to: ${valScreenshot}`);

        // 2. Click Save as draft
        const saveReleaseBtn = page.locator('button:has-text("Save as draft"), button:has-text("Save")').first();
        if (await saveReleaseBtn.count() > 0) {
            const isEnabled = await saveReleaseBtn.isEnabled();
            console.log(`[direct-resolver] 'Save as draft' button enabled state: ${isEnabled}`);
            console.log("[direct-resolver] Clicking 'Save as draft'...");
            await saveReleaseBtn.click();
            await page.waitForTimeout(5000);
        }

        // 3. Click Next
        const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewButton.count() > 0) {
            const isReviewEnabled = await reviewButton.isEnabled();
            console.log(`[direct-resolver] 'Next' button enabled state: ${isReviewEnabled}`);
            console.log("[direct-resolver] Clicking 'Next'...");
            await reviewButton.click();
            await page.waitForTimeout(6000);
        }

        // Capture final rollout dashboard page
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[direct-resolver] Saved final rollout dashboard screenshot to: ${finalScreenshot}`);

    } catch (e) {
        console.error("[direct-resolver] Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[direct-resolver] CDP connection closed.");
    }
}

run();
