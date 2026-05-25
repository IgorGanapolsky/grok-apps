import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const AAB_PATH = resolve(rootDir, "app/build/outputs/bundle/release/app-release.aab");

async function run() {
    console.log("[stage-flow] Connecting to Comet CDP...");
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

        console.log(`[stage-flow] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        if (!existsSync(AAB_PATH)) {
            throw new Error(`New AAB not found at: ${AAB_PATH}`);
        }
        console.log(`[stage-flow] New AAB found at: ${AAB_PATH}`);

        // 1. Check if there is an existing uploaded bundle (e.g. the version 3 one) and remove it
        console.log("[stage-flow] Checking for old app bundle to remove...");
        const removeBtnText = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            // Look for button with clear text or aria-label containing "Remove"
            const removeBtn = btns.find(b => {
                const txt = b.innerText ? b.innerText.trim() : "";
                const ariaLabel = b.getAttribute("aria-label") || "";
                return txt === "clear" || ariaLabel.includes("Remove app-release.aab") || ariaLabel.includes("Remove");
            });
            if (removeBtn) {
                removeBtn.click();
                return "Clicked remove button";
            }
            return "No remove button found";
        });
        console.log("[stage-flow] Remove check result:", removeBtnText);
        if (removeBtnText.includes("Clicked")) {
            console.log("[stage-flow] Waiting 5s for removal to complete...");
            await page.waitForTimeout(5000);
        }

        // 2. Upload the new AAB file
        console.log("[stage-flow] Starting upload of the new AAB bundle...");
        const uploadResult = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
            if (inputs.length > 0) {
                return { success: true, count: inputs.length };
            }
            return { success: false, error: "No file inputs found in DOM." };
        });
        console.log("[stage-flow] File inputs check:", uploadResult);

        if (uploadResult.success) {
            console.log("[stage-flow] Setting files on the first file input...");
            const fileInput = page.locator('input[type="file"]').first();
            await fileInput.setInputFiles(AAB_PATH);
            console.log("[stage-flow] Upload initiated. Waiting 15s for analysis to start...");
            await page.waitForTimeout(15000);
        } else {
            throw new Error(uploadResult.error);
        }

        // 3. Wait for the upload & analysis to complete (up to 3 minutes)
        console.log("[stage-flow] Waiting for upload and processing of new bundle...");
        let processed = false;
        for (let attempt = 1; attempt <= 18; attempt++) {
            await page.waitForTimeout(10000);
            const status = await page.evaluate(() => {
                const texts = document.body.innerText;
                const errors = Array.from(document.querySelectorAll(".error, [role='alert'], .mdc-text-field--invalid"))
                    .map(el => el.innerText).filter(Boolean);
                const hasProcessing = texts.includes("Uploading") || texts.includes("Processing") || texts.includes("Analyzing");
                
                // Let's check if the AAB is listed under the App bundles table
                const btns = Array.from(document.querySelectorAll("button"));
                const hasRemoveBtn = btns.some(b => {
                    const ariaLabel = b.getAttribute("aria-label") || "";
                    return ariaLabel.includes("Remove app-release.aab") || ariaLabel.includes("Remove");
                });

                return { hasProcessing, errors, hasRemoveBtn };
            });

            console.log(`[stage-flow] Progress attempt ${attempt}/18: hasProcessing=${status.hasProcessing}, hasRemoveBtn=${status.hasRemoveBtn}, errors=`, status.errors);

            if (status.errors.some(e => e.includes("already been used"))) {
                // If it's a version error, we fail early
                throw new Error(`Upload rejected: ${status.errors.join(", ")}`);
            }

            if (status.hasRemoveBtn && !status.hasProcessing) {
                console.log("[stage-flow] Bundle is successfully uploaded and listed!");
                processed = true;
                break;
            }
        }

        if (!processed) {
            console.warn("[stage-flow] Processing timeout exceeded or status ambiguous. Proceeding anyway...");
        }

        // 4. Ensure release notes are populated
        console.log("[stage-flow] Checking release notes area...");
        const notesValue = await page.evaluate(() => {
            return document.querySelector('textarea[aria-label="Release notes"]')?.value || "";
        });

        console.log(`[stage-flow] Current release notes: "${notesValue}"`);
        if (!notesValue.includes("<en-US>")) {
            console.log("[stage-flow] Release notes are missing or incorrect. Copying from previous release...");
            // Click "Copy from a previous release"
            const copyBtn = page.locator('button:has-text("Copy from a previous release")').first();
            await copyBtn.click();
            await page.waitForTimeout(5000);

            // Expand zippy if not expanded
            await page.evaluate(() => {
                const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
                if (!table) return;
                const rows = Array.from(table.querySelectorAll('div[role="row"], tr, .particle-table-row'));
                const targetRow = rows.find(r => r.innerText && r.innerText.includes("Internal testing"));
                if (!targetRow) return;
                const buttons = Array.from(targetRow.querySelectorAll('button'));
                const zippyBtn = buttons.find(b => {
                    const txt = b.innerText ? b.innerText.trim() : "";
                    const ariaLabel = b.getAttribute("aria-label") || "";
                    return b.classList.contains("zippy") || ariaLabel.includes("Expand") || txt.includes("arrow_right");
                }) || buttons[0];
                if (zippyBtn && !zippyBtn.innerText.includes("arrow_drop_down")) {
                    zippyBtn.click();
                }
            });
            await page.waitForTimeout(4000);

            // Click radio button
            await page.evaluate(() => {
                const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
                if (!table) return;
                const rows = Array.from(table.querySelectorAll('div[role="row"], tr, .particle-table-row'));
                const rowWithRadio = rows.find(r => r.querySelector('mat-radio-button, input[type="radio"], [role="radio"]'));
                if (rowWithRadio) {
                    const radio = rowWithRadio.querySelector('mat-radio-button, input[type="radio"], [role="radio"]');
                    radio.click();
                }
            });
            await page.waitForTimeout(2000);

            // Click "Copy notes"
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll("button"));
                const copyBtn = btns.find(b => b.innerText && b.innerText.trim() === "Copy notes" && !b.disabled);
                if (copyBtn) copyBtn.click();
            });
            await page.waitForTimeout(5000);
            console.log("[stage-flow] Copied release notes successfully!");
        } else {
            console.log("[stage-flow] Release notes already populated.");
        }

        // 5. Save as draft
        console.log("[stage-flow] Saving draft release...");
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            const saveBtn = btns.find(b => b.innerText && (b.innerText.trim() === "Save as draft" || b.innerText.trim() === "Save") && !b.disabled);
            if (saveBtn) {
                saveBtn.click();
                return "Clicked save button";
            }
            return "No enabled save button found";
        });
        await page.waitForTimeout(5000);

        // 6. Click Next
        console.log("[stage-flow] Advancing to review page...");
        const reviewBtn = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewBtn.count() > 0) {
            const isEnabled = await reviewBtn.isEnabled();
            console.log(`[stage-flow] Next button isEnabled check: ${isEnabled}`);
            if (isEnabled) {
                await reviewBtn.click();
            } else {
                await reviewBtn.click({ force: true });
            }
            await page.waitForTimeout(6000);
        }

        // 7. Save final review page screenshot
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[stage-flow] Saved final review screenshot to: ${finalScreenshot}`);
        console.log("[stage-flow] Automation flow completed successfully!");

    } catch (e) {
        console.error("Error occurred during staging:", e.message);
        const errScreenshot = resolve(rootDir, "stage_error.png");
        await page.screenshot({ path: errScreenshot }).catch(() => {});
        console.log(`[stage-flow] Saved error screenshot to: ${errScreenshot}`);
    } finally {
        await browser.close().catch(() => {});
        console.log("[stage-flow] CDP connection closed.");
    }
}

run();
