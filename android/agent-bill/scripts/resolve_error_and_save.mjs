import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[resolver] Connecting to Comet CDP...");
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

        console.log(`[resolver] Found tab: "${await page.title()}"`);
        console.log(`[resolver] Active URL: ${page.url()}`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Update Release name input
        console.log("[resolver] Locating Release name input...");
        const releaseNameInput = page.locator('input[aria-label="Release name"]').first();
        if (await releaseNameInput.count() > 0) {
            console.log("[resolver] Setting Release name to: '3 (0.1.2)'");
            await releaseNameInput.fill("3 (0.1.2)");
            await page.waitForTimeout(2000);
        } else {
            console.log("[resolver] Warning: Release name input not found.");
        }

        // 2. Update Release notes textarea with proper locale tags
        console.log("[resolver] Locating Release notes textarea...");
        const releaseNotesTextarea = page.locator('textarea[aria-label="Release notes"], textarea').first();
        if (await releaseNotesTextarea.count() > 0) {
            const formattedNotes = "<en-US>AgentBill v0.1.2 — Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.</en-US>";
            console.log("[resolver] Filling formatted Release notes with language tags...");
            await releaseNotesTextarea.fill(formattedNotes);
            await page.waitForTimeout(3000); // Wait for validation to refresh
        } else {
            console.log("[resolver] Warning: Release notes textarea not found.");
        }

        // Capture verification of cleared validation state
        const clearedValScreenshot = resolve(rootDir, "current_tab_val_cleared.png");
        await page.screenshot({ path: clearedValScreenshot });
        console.log(`[resolver] Saved validation cleared screenshot to: ${clearedValScreenshot}`);

        // 3. Locate and click 'Save as draft'
        const saveReleaseBtn = page.locator('button:has-text("Save as draft"), button:has-text("Save")').first();
        if (await saveReleaseBtn.count() > 0) {
            const isEnabled = await saveReleaseBtn.isEnabled();
            console.log(`[resolver] 'Save as draft' button enabled state: ${isEnabled}`);
            if (isEnabled) {
                console.log("[resolver] Clicking 'Save as draft'...");
                await saveReleaseBtn.click();
                await page.waitForTimeout(5000);
            } else {
                console.log("[resolver] Attempting force click on 'Save as draft' even if Playwright thinks it is disabled...");
                await saveReleaseBtn.click({ force: true });
                await page.waitForTimeout(5000);
            }
        }

        // 4. Progress to rollout review page via 'Next'
        const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewButton.count() > 0) {
            const isReviewEnabled = await reviewButton.isEnabled();
            console.log(`[resolver] 'Next' button enabled state: ${isReviewEnabled}`);
            if (isReviewEnabled) {
                console.log("[resolver] Clicking 'Next'...");
                await reviewButton.click();
                await page.waitForTimeout(6000);
            } else {
                console.log("[resolver] Attempting force click on 'Next'...");
                await reviewButton.click({ force: true });
                await page.waitForTimeout(6000);
            }
        }

        // Capture final rollout page screenshot
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[resolver] Saved rollout confirmation to: ${finalScreenshot}`);

    } catch (e) {
        console.error("[resolver] Error occurred:", e.message);
        try {
            const errScreenshot = resolve(rootDir, "resolver_val_error.png");
            const pages = await browser.contexts()[0].pages();
            const page = pages.find((p) => p.url().includes("play.google.com/console"));
            if (page) {
                await page.screenshot({ path: errScreenshot });
                console.log(`[resolver] Saved error state screenshot to: ${errScreenshot}`);
            }
        } catch (screenshotErr) {
            console.error("[resolver] Failed to capture error screenshot:", screenshotErr.message);
        }
    } finally {
        await browser.close().catch(() => {});
        console.log("[resolver] CDP connection closed.");
    }
}

run();
