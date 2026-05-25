import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[clicker] Connecting to Comet CDP...");
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

        console.log(`[clicker] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // Let's run click detection logic inside the browser
        const result = await page.evaluate(async () => {
            // Find the dialog
            const dialog = document.querySelector('div[role="dialog"], .popup, mat-dialog-container, relative-popup');
            if (!dialog) {
                return { error: "No modal dialog open." };
            }

            // Find all table rows
            const rows = Array.from(document.querySelectorAll("tr, div[role='row'], .particle-table-row"));
            const targetRow = rows.find(r => {
                const text = r.innerText ? r.innerText.trim() : "";
                return text.includes("Internal testing") && text.includes("0.1.0");
            });

            if (!targetRow) {
                return { error: "Target row for 'Internal testing 0.1.0' not found." };
            }

            console.log("Found target row:", targetRow.innerText);

            // Find the Copy Notes button so we can monitor its state
            const findCopyBtn = () => {
                const btns = Array.from(document.querySelectorAll("button"));
                return btns.find(b => b.innerText && b.innerText.trim() === "Copy notes");
            };

            const copyBtnBefore = findCopyBtn();
            if (!copyBtnBefore) {
                return { error: "'Copy notes' button not found in modal." };
            }

            console.log("'Copy notes' disabled state initially:", copyBtnBefore.disabled);

            // Let's gather all potentially clickable elements in the row
            const clickables = Array.from(targetRow.querySelectorAll("input, button, label, span, div, ess-cell, console-table-tools-cell, material-radio"));
            console.log(`Gathered ${clickables.length} elements inside target row to test clicking.`);

            let clickedIdx = -1;
            let success = false;

            // Try clicking the row directly first
            targetRow.click();
            await new Promise(r => setTimeout(r, 800));
            if (!findCopyBtn().disabled) {
                console.log("Direct row click succeeded in enabling the button!");
                success = true;
                clickedIdx = 999;
            }

            // If direct row click didn't work, try each child element
            if (!success) {
                for (let i = 0; i < clickables.length; i++) {
                    const el = clickables[i];
                    console.log(`Testing click on #${i}: tag=${el.tagName}, class="${el.className}"`);
                    
                    // Trigger native click
                    el.click();
                    
                    // If it is a radio button, also try setting checked to true and dispatching events
                    if (el.tagName === 'INPUT' && el.type === 'radio') {
                        el.checked = true;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.dispatchEvent(new Event('click', { bubbles: true }));
                    }

                    await new Promise(r => setTimeout(r, 800));

                    const currentCopyBtn = findCopyBtn();
                    if (currentCopyBtn && !currentCopyBtn.disabled) {
                        console.log(`SUCCESS! Click on element #${i} enabled the 'Copy notes' button!`);
                        clickedIdx = i;
                        success = true;
                        break;
                    }
                }
            }

            if (success) {
                // Click the enabled Copy notes button!
                const activeCopyBtn = findCopyBtn();
                activeCopyBtn.click();
                return { success: true, clickedIdx };
            }

            return { success: false, error: "Could not enable the Copy notes button after clicking all elements." };
        });

        console.log("[clicker] Click evaluation result:", result);
        await page.waitForTimeout(5000); // Wait for modal to dismiss and populated notes to settle

        // Take populated screenshot
        const popScreenshot = resolve(rootDir, "current_tab_after_modal_copied.png");
        await page.screenshot({ path: popScreenshot });
        console.log(`[clicker] Saved screenshot to: ${popScreenshot}`);

        // Read page state
        const finalState = await page.evaluate(() => {
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
        console.log("Validation Errors:", finalState.errs);
        console.log("Textarea Value:", `"${finalState.textareaValue}"`);
        console.log("---------------------------\n");

    } catch (e) {
        console.error("[clicker] Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[clicker] CDP connection closed.");
    }
}

run();
