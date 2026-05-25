import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[expander] Connecting to Comet CDP...");
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

        console.log(`[expander] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Open the modal if not already open
        const isOpen = await page.evaluate(() => {
            const modal = document.querySelector('div[role="dialog"], .popup');
            if (modal) {
                const header = modal.querySelector('h2');
                return header && header.innerText.includes("Copy notes from a previous release");
            }
            return false;
        });

        if (!isOpen) {
            console.log("[expander] Modal is not open. Clicking 'Copy from a previous release' button...");
            const copyBtn = page.locator('button:has-text("Copy from a previous release")').first();
            await copyBtn.click();
            console.log("[expander] Clicked button, waiting 5s for modal to render...");
            await page.waitForTimeout(5000);
        } else {
            console.log("[expander] Modal is already open.");
        }

        // 2. Click the zippy button to expand the 'Internal testing' track row
        console.log("[expander] Clicking zippy button to expand the row...");
        const expandResult = await page.evaluate(async () => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            if (!table) return { success: false, error: "Modal table not found." };

            const rows = Array.from(table.querySelectorAll('div[role="row"], tr, .particle-table-row'));
            const targetRow = rows.find(r => r.innerText && r.innerText.includes("Internal testing"));
            if (!targetRow) return { success: false, error: "Internal testing row not found." };

            // Find zippy button
            const zippyBtn = targetRow.querySelector('.zippy, button[aria-label*="Expand"], button:has-text("arrow_right"), button');
            if (!zippyBtn) return { success: false, error: "Zippy button not found in row." };

            zippyBtn.click();
            return { success: true, clickedBtnOuterHTML: zippyBtn.outerHTML };
        });

        console.log("[expander] Expand zippy click result:", expandResult);
        if (!expandResult.success) {
            throw new Error(expandResult.error);
        }

        console.log("[expander] Waiting 4s for rows to expand and release rows to populate...");
        await page.waitForTimeout(4000);

        // 3. Inspect the table rows after expansion
        const postExpandRows = await page.evaluate(() => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            if (!table) return { error: "Table not found post expand." };

            const rows = Array.from(table.querySelectorAll('div[role="row"], tr, .particle-table-row'));
            return {
                rowCount: rows.length,
                rows: rows.map((r, i) => {
                    const cells = Array.from(r.querySelectorAll('td, div[role="gridcell"], ess-cell'));
                    const radio = r.querySelector('mat-radio-button, input[type="radio"], [role="radio"]');
                    return {
                        index: i,
                        innerText: r.innerText ? r.innerText.trim() : "",
                        cellTexts: cells.map(c => c.innerText ? c.innerText.trim() : ""),
                        hasRadio: !!radio,
                        radioRole: radio ? radio.getAttribute("role") : null,
                        radioChecked: radio ? (radio.getAttribute("aria-checked") === "true" || radio.checked) : null
                    };
                })
            };
        });

        console.log("\n--- POST-EXPAND ROWS DETAIL ---");
        console.log(JSON.stringify(postExpandRows, null, 2));
        console.log("-------------------------------\n");

        // 4. Click the radio button inside the newly revealed release row
        console.log("[expander] Clicking the radio button of the release row...");
        const clickRadioResult = await page.evaluate(async () => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            if (!table) return { success: false, error: "Table not found for clicking radio." };

            const rows = Array.from(table.querySelectorAll('div[role="row"], tr, .particle-table-row'));
            // Find a row that is a child release row. It should have index >= 2, and innerText containing the version/release
            // Let's look for a row with role="row" and a radio button, but not the track header row if it also had one.
            // Let's filter for rows containing "0.1.0" or "0.1.1" or "0.1.2".
            const releaseRow = rows.find(r => {
                const text = r.innerText ? r.innerText.trim() : "";
                return (text.includes("0.1.0") || text.includes("0.1.1") || text.includes("0.1.2")) && !text.includes("Internal testing\n0.1.0");
            });

            if (!releaseRow) {
                // If not found by version, let's just pick any row with a radio button that is not the track row
                const candidateRows = rows.filter(r => r.querySelector('mat-radio-button, input[type="radio"], [role="radio"]'));
                if (candidateRows.length > 1) {
                    // Pick the second row (the first child row)
                    const secondRow = candidateRows[1];
                    const radio = secondRow.querySelector('mat-radio-button, input[type="radio"], [role="radio"]');
                    radio.click();
                    return { success: true, selectedMethod: "second radio row", text: secondRow.innerText };
                }
                return { success: false, error: "Could not locate child release row." };
            }

            const radio = releaseRow.querySelector('mat-radio-button, input[type="radio"], [role="radio"]');
            if (!radio) return { success: false, error: "Radio not found in target release row." };

            radio.click();
            return { success: true, selectedMethod: "releaseRow match", text: releaseRow.innerText };
        });

        console.log("[expander] Click radio result:", clickRadioResult);
        if (!clickRadioResult.success) {
            throw new Error(clickRadioResult.error);
        }

        await page.waitForTimeout(2000);

        // 5. Verify the 'Copy notes' button is enabled and click it
        console.log("[expander] Clicking 'Copy notes' button...");
        const copyBtnResult = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            const copyBtn = btns.find(b => b.innerText && b.innerText.trim() === "Copy notes");
            if (!copyBtn) return { success: false, error: "'Copy notes' button not found." };
            if (copyBtn.disabled || copyBtn.getAttribute("aria-disabled") === "true") {
                return { success: false, error: "'Copy notes' button is still disabled." };
            }

            copyBtn.click();
            return { success: true };
        });

        console.log("[expander] Click 'Copy notes' button result:", copyBtnResult);
        if (!copyBtnResult.success) {
            throw new Error(copyBtnResult.error);
        }

        console.log("[expander] Successfully clicked 'Copy notes'. Waiting 6s for modal dismissal and population...");
        await page.waitForTimeout(6000);

        // Capture verification screenshot
        const screenshotPath2 = resolve(rootDir, "current_tab_after_copy_previous.png");
        await page.screenshot({ path: screenshotPath2 });
        console.log(`[expander] Saved post-copy screenshot to: ${screenshotPath2}`);

        // Read page state
        const state = await page.evaluate(() => {
            const errs = Array.from(document.querySelectorAll(".error, [role='alert'], .mdc-text-field--invalid")).map(el => el.innerText).filter(Boolean);
            const textareaValue = document.querySelector('textarea[aria-label="Release notes"]')?.value || "";
            return { errs, textareaValue };
        });

        console.log("\n--- POST-COPY DOM STATE ---");
        console.log("Validation Errors:", state.errs);
        console.log("Textarea Value:", `"${state.textareaValue}"`);
        console.log("---------------------------\n");

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[expander] CDP connection closed.");
    }
}

run();
