import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[copy-flow] Connecting to Comet CDP...");
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

        console.log(`[copy-flow] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Check if modal is already open
        const isModalOpen = await page.evaluate(() => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            return !!table;
        });

        if (!isModalOpen) {
            // Reload the page to reset state completely if not open
            console.log("[copy-flow] Reloading page to ensure a clean slate...");
            await page.reload();
            console.log("[copy-flow] Waiting 10s for page to load completely...");
            await page.waitForTimeout(10000);

            console.log("[copy-flow] Clicking 'Copy from a previous release' button...");
            const copyBtn = page.locator('button:has-text("Copy from a previous release")').first();
            await copyBtn.click();
            console.log("[copy-flow] Clicked button, waiting 5s for modal to render...");
            await page.waitForTimeout(5000);
        } else {
            console.log("[copy-flow] Modal is already open. Proceeding directly...");
        }

        const expandResult = await page.evaluate(() => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            if (!table) return { success: false, error: "Modal table not found." };

            const rows = Array.from(table.querySelectorAll('div[role="row"], tr, .particle-table-row'));
            const targetRow = rows.find(r => r.innerText && r.innerText.includes("Internal testing"));
            if (!targetRow) return { success: false, error: "Internal testing row not found." };

            // Find zippy button natively without pseudo-selectors
            const buttons = Array.from(targetRow.querySelectorAll('button'));
            const zippyBtn = buttons.find(b => {
                const txt = b.innerText ? b.innerText.trim() : "";
                const ariaLabel = b.getAttribute("aria-label") || "";
                return b.classList.contains("zippy") || ariaLabel.includes("Expand") || txt.includes("arrow_right") || txt.includes("arrow_drop_down");
            }) || buttons[0];

            if (!zippyBtn) return { success: false, error: "Zippy button not found in row." };

            const txt = zippyBtn.innerText ? zippyBtn.innerText.trim() : "";
            if (txt.includes("arrow_drop_down") || rows.some(r => r.classList.contains("particle-table-drilldown-row"))) {
                return { success: true, alreadyExpanded: true };
            }

            zippyBtn.click();
            return { success: true, alreadyExpanded: false };
        });

        console.log("[copy-flow] Zippy expand click result:", expandResult);
        if (!expandResult.success) {
            throw new Error(expandResult.error);
        }

        if (!expandResult.alreadyExpanded) {
            console.log("[copy-flow] Waiting 4s for rows to expand...");
            await page.waitForTimeout(4000);
        }

        // 4. Click the radio button inside the track row
        console.log("[copy-flow] Clicking the radio button of the track row...");
        const clickRadioResult = await page.evaluate(() => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            if (!table) return { success: false, error: "Table not found." };

            const rows = Array.from(table.querySelectorAll('div[role="row"], tr, .particle-table-row'));
            const rowWithRadio = rows.find(r => r.querySelector('mat-radio-button, input[type="radio"], [role="radio"]'));
            if (!rowWithRadio) {
                return { success: false, error: "No row with radio button found in table." };
            }

            const radio = rowWithRadio.querySelector('mat-radio-button, input[type="radio"], [role="radio"]');
            radio.click();
            return { success: true, method: "rowWithRadio match", text: rowWithRadio.innerText };
        });

        console.log("[copy-flow] Click radio result:", clickRadioResult);
        if (!clickRadioResult.success) {
            throw new Error(clickRadioResult.error);
        }

        await page.waitForTimeout(2000);

        // 5. Click the enabled 'Copy notes' button
        console.log("[copy-flow] Clicking 'Copy notes' button...");
        const copyNotesResult = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            const copyBtn = btns.find(b => b.innerText && b.innerText.trim() === "Copy notes");
            if (!copyBtn) return { success: false, error: "'Copy notes' button not found." };
            if (copyBtn.disabled || copyBtn.getAttribute("aria-disabled") === "true") {
                return { success: false, error: "'Copy notes' button is disabled." };
            }

            copyBtn.click();
            return { success: true };
        });

        console.log("[copy-flow] Copy notes click result:", copyNotesResult);
        if (!copyNotesResult.success) {
            throw new Error(copyNotesResult.error);
        }

        console.log("[copy-flow] Successfully clicked 'Copy notes'. Waiting 6s for modal dismissal and population...");
        await page.waitForTimeout(6000);

        // Capture verification screenshot
        const screenshotPath = resolve(rootDir, "current_tab_after_modal_copied.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[copy-flow] Saved post-copy screenshot to: ${screenshotPath}`);

        // Read page state
        const state = await page.evaluate(() => {
            const errs = Array.from(document.querySelectorAll(".error, [role='alert'], .mdc-text-field--invalid")).map(el => el.innerText).filter(Boolean);
            const textareaValue = document.querySelector('textarea[aria-label="Release notes"]')?.value || "";
            const btns = Array.from(document.querySelectorAll("button")).map(b => ({
                text: b.innerText ? b.innerText.trim() : "",
                enabled: !b.disabled && b.getAttribute("aria-disabled") !== "true",
                visible: b.getBoundingClientRect().height > 0
            }));
            return { errs, textareaValue, btns };
        });

        console.log("\n--- POST-COPY DOM STATE ---");
        console.log("Validation Errors:", state.errs);
        console.log("Textarea Value:", `"${state.textareaValue}"`);
        
        const saveBtn = state.btns.find(b => b.text === "Save as draft");
        console.log("Save as draft button state:", saveBtn);

        const nextBtn = state.btns.find(b => b.text === "Next");
        console.log("Next button state:", nextBtn);
        console.log("---------------------------\n");

        // 6. Click Save as draft if enabled
        if (saveBtn && saveBtn.enabled) {
            console.log("[copy-flow] Clicking 'Save as draft'...");
            await page.locator('button:has-text("Save as draft")').first().click();
            await page.waitForTimeout(5000);
        } else {
            console.log("[copy-flow] Save as draft not enabled. Attempting inline Save...");
            const clickedInline = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll("button"));
                const save = btns.find(b => b.innerText && b.innerText.trim() === "Save" && !b.disabled && b.getBoundingClientRect().height > 0);
                if (save) {
                    save.click();
                    return true;
                }
                return false;
            });
            if (clickedInline) {
                console.log("[copy-flow] Clicked inline 'Save' successfully. Waiting 5s...");
                await page.waitForTimeout(5000);
            }
        }

        // 7. Click Next
        const reviewBtn = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewBtn.count() > 0) {
            const isEnabled = await reviewBtn.isEnabled();
            console.log(`[copy-flow] Next button isEnabled check: ${isEnabled}`);
            if (isEnabled) {
                console.log("[copy-flow] Clicking 'Next' button...");
                await reviewBtn.click();
                await page.waitForTimeout(6000);
            } else {
                console.log("[copy-flow] Attempting force click on 'Next' button...");
                await reviewBtn.click({ force: true });
                await page.waitForTimeout(6000);
            }
        }

        // Capture final rollout page
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[copy-flow] Saved final rollout dashboard screenshot to: ${finalScreenshot}`);

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[copy-flow] CDP connection closed.");
    }
}

run();
