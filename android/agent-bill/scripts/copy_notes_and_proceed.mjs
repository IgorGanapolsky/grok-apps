import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[stager] Connecting to Comet CDP...");
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

        console.log(`[stager] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Locate and click the mat-radio-button in the Copy Notes modal
        console.log("[stager] Clicking the <mat-radio-button> in the selection modal...");
        const clickResult = await page.evaluate(() => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            if (!table) {
                return { success: false, error: "Modal table not found." };
            }

            const radioButton = table.querySelector('mat-radio-button, [role="radio"], .mdc-radio');
            if (!radioButton) {
                return { success: false, error: "<mat-radio-button> element not found in table cell." };
            }

            radioButton.click();
            return { success: true, outerHTML: radioButton.outerHTML };
        });

        console.log("[stager] Click result:", clickResult);
        if (!clickResult.success) {
            throw new Error(clickResult.error);
        }

        await page.waitForTimeout(2000);

        // 2. Click the 'Copy notes' button in the modal
        console.log("[stager] Verifying and clicking 'Copy notes' button...");
        const copyBtnClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            const copyBtn = btns.find(b => b.innerText && b.innerText.trim() === "Copy notes");
            if (!copyBtn) {
                return { success: false, error: "'Copy notes' button not found." };
            }
            if (copyBtn.disabled || copyBtn.getAttribute("aria-disabled") === "true") {
                return { success: false, error: "'Copy notes' button is disabled.", outerHTML: copyBtn.outerHTML };
            }

            copyBtn.click();
            return { success: true };
        });

        console.log("[stager] Copy button action result:", copyBtnClicked);
        if (!copyBtnClicked.success) {
            // Save state screenshot to diagnose why button is disabled
            const errScreenshot = resolve(rootDir, "current_tab_after_copy_previous.png");
            await page.screenshot({ path: errScreenshot });
            console.log(`[stager] Saved state screenshot to: ${errScreenshot}`);
            throw new Error(copyBtnClicked.error);
        }

        console.log("[stager] Successfully clicked 'Copy notes'. Waiting 6s for modal dismissal and population...");
        await page.waitForTimeout(6000);

        // Capture verification of populated state
        const populatedScreenshot = resolve(rootDir, "current_tab_after_modal_copied.png");
        await page.screenshot({ path: populatedScreenshot });
        console.log(`[stager] Saved screenshot to: ${populatedScreenshot}`);

        // 3. Inspect the DOM text and errors
        const state = await page.evaluate(() => {
            const errs = Array.from(document.querySelectorAll(".error, [role='alert'], .mdc-text-field--invalid, [aria-live='assertive']")).map(el => el.innerText).filter(Boolean);
            const textareaValue = document.querySelector('textarea[aria-label="Release notes"]')?.value || "";
            const btns = Array.from(document.querySelectorAll("button")).map(b => ({
                text: b.innerText ? b.innerText.trim() : "",
                enabled: !b.disabled && b.getAttribute("aria-disabled") !== "true",
                visible: b.getBoundingClientRect().height > 0
            }));
            return { errs, textareaValue, btns };
        });

        console.log("\n--- POST-COPY STATE ---");
        console.log("Validation Errors:", state.errs);
        console.log("Textarea Value:", `"${state.textareaValue}"`);
        console.log("-----------------------\n");

        // 4. Click the Card Save Button or Save as draft
        console.log("[stager] Clicking Save / Save as draft...");
        const saveAction = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            
            // Try Card Inline Save button first
            const saveBtn = btns.find(b => {
                const text = b.innerText ? b.innerText.trim() : "";
                const isEnabled = !b.disabled && b.getAttribute("aria-disabled") !== "true";
                const isVisible = b.getBoundingClientRect().height > 0;
                return text === "Save" && isEnabled && isVisible;
            });
            if (saveBtn) {
                saveBtn.click();
                return "clicked_inline_save";
            }

            // Try Footer Save as draft button
            const saveDraftBtn = btns.find(b => {
                const text = b.innerText ? b.innerText.trim() : "";
                const isEnabled = !b.disabled && b.getAttribute("aria-disabled") !== "true";
                const isVisible = b.getBoundingClientRect().height > 0;
                return text === "Save as draft" && isEnabled && isVisible;
            });
            if (saveDraftBtn) {
                saveDraftBtn.click();
                return "clicked_save_as_draft";
            }

            return "no_save_button_enabled";
        });

        console.log(`[stager] Save button action: ${saveAction}`);
        await page.waitForTimeout(5000);

        // Take save confirmation screenshot
        const saveScreenshot = resolve(rootDir, "current_tab_after_card_saved.png");
        await page.screenshot({ path: saveScreenshot });
        console.log(`[stager] Saved after-save screenshot to: ${saveScreenshot}`);

        // 5. Progress to rollout review page via 'Next'
        const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewButton.count() > 0) {
            const isEnabled = await reviewButton.isEnabled();
            console.log(`[stager] Global 'Next' button isEnabled: ${isEnabled}`);
            if (isEnabled) {
                console.log("[stager] Clicking global 'Next' button...");
                await reviewButton.click();
                await page.waitForTimeout(6000);
            } else {
                console.log("[stager] 'Next' button is disabled. Attempting force click...");
                await reviewButton.click({ force: true });
                await page.waitForTimeout(6000);
            }
        }

        // Capture final rollout dashboard page
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[stager] Saved rollout confirmation to: ${finalScreenshot}`);

    } catch (e) {
        console.error("[stager] Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[stager] CDP connection closed.");
    }
}

run();
