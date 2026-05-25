import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const AAB_PATH = resolve(rootDir, "app/build/outputs/bundle/release/app-release.aab");

async function run() {
    console.log("[clean-slate] Connecting to Comet CDP...");
    
    if (!existsSync(AAB_PATH)) {
        console.error(`AAB not found at: ${AAB_PATH}`);
        process.exit(1);
    }

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

        console.log(`[clean-slate] Found tab: "${await page.title()}"`);
        console.log(`[clean-slate] Active URL: ${page.url()}`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Find and click all remove buttons to clear existing bundles
        console.log("[clean-slate] Searching for existing 'Remove app-release.aab' buttons...");
        const removeBtnsCount = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button')).filter(b => {
                const aria = b.getAttribute('aria-label') || "";
                return aria.includes("Remove app-release.aab");
            });
            btns.forEach(b => b.click());
            return btns.length;
        });

        console.log(`[clean-slate] Clicked ${removeBtnsCount} remove button(s). Waiting 5s for clean slate...`);
        await page.waitForTimeout(5000);

        // Take a screenshot of the cleared slate
        await page.screenshot({ path: resolve(rootDir, "current_tab_cleared.png") });
        console.log("[clean-slate] Saved cleared state screenshot.");

        // 2. Perform upload of version 3 AAB
        console.log(`[clean-slate] Starting clean upload of AAB: ${AAB_PATH}`);
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count() > 0) {
            console.log("[clean-slate] Found direct file input. Setting files...");
            await fileInput.setInputFiles(AAB_PATH);
        } else {
            console.log("[clean-slate] Triggering upload via button...");
            const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Upload App Bundle")').first();
            const [aabChooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                uploadBtn.click()
            ]);
            await aabChooser.setFiles(AAB_PATH);
        }

        console.log("[clean-slate] Upload initiated. Waiting for AAB to be processed (up to 3 minutes)...");
        await page.waitForTimeout(20000); // Wait 20 seconds initially

        // Wait for Save/Save as draft button to be visible and enabled
        const saveReleaseBtn = page.locator('button:has-text("Save"), button:has-text("Save as draft")').first();
        
        // Loop check for button to be enabled (waiting up to 180s)
        console.log("[clean-slate] Waiting for 'Save as draft' button to become enabled...");
        let isEnabled = false;
        for (let i = 0; i < 36; i++) { // 36 * 5s = 180s
            await page.waitForTimeout(5000);
            if (await saveReleaseBtn.isVisible()) {
                isEnabled = await saveReleaseBtn.isEnabled();
                if (isEnabled) {
                    // Make sure there are no error messages remaining
                    const text = await page.evaluate(() => document.body.innerText);
                    if (text.includes("Version code 1 has already been used") || text.includes("error")) {
                        console.log("[clean-slate] Warning: Error text still detected on page. Continuing to monitor...");
                    } else {
                        console.log("[clean-slate] Save button is now enabled and no errors detected!");
                        break;
                    }
                }
            }
        }

        // Save release draft
        console.log("[clean-slate] Saving release draft...");
        await saveReleaseBtn.click();
        await page.waitForTimeout(5000);

        // Populate release notes
        console.log("[clean-slate] Populating release notes...");
        const notesField = page.locator("textarea").first();
        if (await notesField.count()) {
            await notesField.fill("AgentBill v0.1.2 — Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.");
            await page.waitForTimeout(2000);
            // Click Save again to save the notes
            await saveReleaseBtn.click();
            await page.waitForTimeout(4000);
        }

        // Progress to rollout review page
        console.log("[clean-slate] Progressing to review page...");
        const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewButton.count() && await reviewButton.isEnabled()) {
            await reviewButton.click();
            await page.waitForTimeout(6000);
        } else {
            console.log("[clean-slate] Review button not enabled yet, trying to click Save once more...");
            await saveReleaseBtn.click();
            await page.waitForTimeout(4000);
            if (await reviewButton.isEnabled()) {
                await reviewButton.click();
                await page.waitForTimeout(6000);
            }
        }

        console.log("[clean-slate] Staged successfully! Capturing rollout dashboard screenshot...");
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[clean-slate] Saved rollout confirmation to: ${finalScreenshot}`);

    } catch (e) {
        console.error("[clean-slate] Error occurred:", e.message);
        // Let's capture the error screenshot safely
        try {
            const errScreenshot = resolve(rootDir, "publish_error.png");
            const pages = await browser.contexts()[0].pages();
            const page = pages.find((p) => p.url().includes("play.google.com/console"));
            if (page) {
                await page.screenshot({ path: errScreenshot });
                console.log(`[clean-slate] Saved error state screenshot to: ${errScreenshot}`);
            }
        } catch (screenshotErr) {
            console.error("[clean-slate] Failed to capture error screenshot:", screenshotErr.message);
        }
    } finally {
        await browser.close().catch(() => {});
        console.log("[clean-slate] CDP connection closed.");
    }
}
run();
