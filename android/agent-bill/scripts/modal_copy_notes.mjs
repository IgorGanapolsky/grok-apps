import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[modal] Connecting to Comet CDP...");
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

        console.log(`[modal] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Click the radio button in the modal
        console.log("[modal] Selecting the radio button for the previous release...");
        const radioClicked = await page.evaluate(() => {
            // Find radio button or the row that contains 'Internal testing'
            const rows = Array.from(document.querySelectorAll("tr, div[role='row'], label, div"));
            const targetRow = rows.find(el => el.innerText && el.innerText.includes("Internal testing") && el.innerText.includes("0.1.0"));
            if (targetRow) {
                const radio = targetRow.querySelector("input[type='radio'], [role='radio'], .mdc-radio");
                if (radio) {
                    radio.click();
                    return "clicked_radio_in_row";
                }
                targetRow.click();
                return "clicked_row_directly";
            }

            // Fallback: click first radio button on page
            const firstRadio = document.querySelector("input[type='radio'], [role='radio'], .mdc-radio");
            if (firstRadio) {
                firstRadio.click();
                return "clicked_first_radio_fallback";
            }
            return "no_radio_found";
        });
        console.log(`[modal] Radio button click action: ${radioClicked}`);
        await page.waitForTimeout(1500);

        // 2. Click the 'Copy notes' submit button
        console.log("[modal] Clicking the 'Copy notes' button...");
        const submitClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            const copyBtn = btns.find(b => b.innerText && b.innerText.trim() === "Copy notes" && !b.disabled);
            if (copyBtn) {
                copyBtn.click();
                return true;
            }
            return false;
        });

        if (submitClicked) {
            console.log("[modal] Clicked 'Copy notes' submit successfully! Waiting 5s for population...");
            await page.waitForTimeout(5000);
        } else {
            console.log("[modal] Warning: Enabled 'Copy notes' button not found. Attempting force click via Playwright selector...");
            const copyLoc = page.locator('button:has-text("Copy notes")').first();
            await copyLoc.click({ force: true });
            await page.waitForTimeout(5000);
        }

        // Capture populated state screenshot
        const populatedScreenshot = resolve(rootDir, "current_tab_after_modal_copied.png");
        await page.screenshot({ path: populatedScreenshot });
        console.log(`[modal] Saved populated screenshot to: ${populatedScreenshot}`);

        // 3. Inspect errors and button states in DOM
        const state = await page.evaluate(() => {
            const errs = Array.from(document.querySelectorAll(".error, [role='alert'], .mdc-text-field--invalid")).map(el => el.innerText).filter(Boolean);
            const textareaValue = document.querySelector('textarea[aria-label="Release notes"]')?.value || "";
            const btns = Array.from(document.querySelectorAll("button")).map(b => ({
                text: b.innerText ? b.innerText.trim() : "",
                enabled: !b.disabled && b.getAttribute("aria-disabled") !== "true"
            }));
            return { errs, textareaValue, btns };
        });

        console.log("\n--- POST-COPY DOM STATE ---");
        console.log("Validation Errors:", state.errs);
        console.log("Textarea Value:", `"${state.textareaValue}"`);
        console.log("---------------------------\n");

        // 4. Click the card-specific Save button to commit release details
        console.log("[modal] Clicking the inline card 'Save' button...");
        const clickedInlineSave = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
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

        if (clickedInlineSave) {
            console.log("[modal] Clicked inline 'Save' button successfully! Waiting 5s...");
            await page.waitForTimeout(5000);
        }

        // 5. Click the global Next button
        const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewButton.count() > 0) {
            const isEnabled = await reviewButton.isEnabled();
            console.log(`[modal] Global 'Next' button isEnabled: ${isEnabled}`);
            console.log("[modal] Clicking global 'Next' button...");
            await reviewButton.click();
            await page.waitForTimeout(6000);
        }

        // Capture final rollout dashboard page
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[modal] Saved final rollout dashboard screenshot to: ${finalScreenshot}`);

    } catch (e) {
        console.error("[modal] Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[modal] CDP connection closed.");
    }
}

run();
