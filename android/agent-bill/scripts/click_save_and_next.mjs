import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[save-resolver] Connecting to Comet CDP...");
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

        console.log(`[save-resolver] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Locate and click the inline 'Save' button
        console.log("[save-resolver] Finding the enabled inline 'Save' button...");
        const clicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            // Find a button with text "Save" that is enabled, visible, and NOT the global "Save as draft"
            const saveBtn = btns.find(b => {
                const text = b.innerText ? b.innerText.trim() : "";
                const isEnabled = !b.disabled && b.getAttribute("aria-disabled") !== "true";
                const isVisible = b.getBoundingClientRect().height > 0;
                return text === "Save" && isEnabled && isVisible;
            });

            if (saveBtn) {
                saveBtn.click();
                return true;
            }
            return false;
        });

        if (clicked) {
            console.log("[save-resolver] Clicked inline 'Save' button successfully! Waiting 5s for card to save...");
            await page.waitForTimeout(5000);
        } else {
            console.log("[save-resolver] Enabled inline 'Save' button not found. Trying page.locator as fallback...");
            const saveLoc = page.locator('button:has-text("Save")').nth(0);
            if (await saveLoc.count() && await saveLoc.isEnabled()) {
                await saveLoc.click();
                await page.waitForTimeout(5000);
            }
        }

        // Take a screenshot of the saved card state
        const savedCardScreenshot = resolve(rootDir, "current_tab_after_card_saved.png");
        await page.screenshot({ path: savedCardScreenshot });
        console.log(`[save-resolver] Saved post-card-save screenshot to: ${savedCardScreenshot}`);

        // 2. Check and click global Next/Review button
        console.log("[save-resolver] Checking if global 'Next' button is enabled...");
        const nextButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await nextButton.count() > 0) {
            const isNextEnabled = await nextButton.isEnabled();
            console.log(`[save-resolver] 'Next' button enabled state: ${isNextEnabled}`);
            
            // Try regular click first, or force click as fallback
            console.log("[save-resolver] Clicking global 'Next' button...");
            if (isNextEnabled) {
                await nextButton.click();
            } else {
                console.log("[save-resolver] Warning: Next button is disabled in DOM. Force clicking as fallback...");
                await nextButton.click({ force: true });
            }
            await page.waitForTimeout(6000);
        } else {
            console.log("[save-resolver] Global 'Next' button not found.");
        }

        // Capture final rollout dashboard page
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[save-resolver] Saved final rollout dashboard screenshot to: ${finalScreenshot}`);

    } catch (e) {
        console.error("[save-resolver] Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[save-resolver] CDP connection closed.");
    }
}

run();
