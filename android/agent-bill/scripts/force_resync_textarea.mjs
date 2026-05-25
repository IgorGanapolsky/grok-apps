import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[resync] Connecting to Comet CDP...");
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

        console.log(`[resync] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Clear and reset the textarea
        console.log("[resync] Natively resetting the Release Notes textarea to empty...");
        await page.evaluate(() => {
            const ta = document.querySelector('textarea[aria-label="Release notes"], textarea');
            if (ta) {
                ta.value = "";
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                ta.dispatchEvent(new Event('change', { bubbles: true }));
                ta.dispatchEvent(new Event('blur', { bubbles: true }));
                console.log("[browser] Cleared textarea and dispatched events.");
            } else {
                console.error("[browser] Release notes textarea not found.");
            }
        });
        await page.waitForTimeout(2000);

        // 2. Set the correct value
        console.log("[resync] Natively injecting correct Release Notes with language tags...");
        const targetNotes = "<en-US>AgentBill v0.1.2 - Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.</en-US>";
        await page.evaluate((val) => {
            const ta = document.querySelector('textarea[aria-label="Release notes"], textarea');
            if (ta) {
                ta.value = val;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                ta.dispatchEvent(new Event('change', { bubbles: true }));
                ta.dispatchEvent(new Event('blur', { bubbles: true }));
                console.log("[browser] Set value and dispatched events.");
            }
        }, targetNotes);

        console.log("[resync] Waiting 4s for Angular validator to digest...");
        await page.waitForTimeout(4000);

        // Capture verification screenshot
        const step1Screenshot = resolve(rootDir, "current_tab_cleared_error.png");
        await page.screenshot({ path: step1Screenshot });
        console.log(`[resync] Saved state screenshot to: ${step1Screenshot}`);

        // 3. Inspect errors and buttons in DOM
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

        console.log("\n--- POST-RESYNC STATE ---");
        console.log("Validation Errors:", state.errs);
        console.log("Textarea Value:", `"${state.textareaValue}"`);
        console.log("-------------------------\n");

        const saveBtn = state.btns.find(b => b.text === "Save as draft");
        console.log("Save as draft button state:", saveBtn);

        const nextBtn = state.btns.find(b => b.text === "Next");
        console.log("Next button state:", nextBtn);

        // 4. Click Save as draft if enabled
        if (saveBtn && saveBtn.enabled) {
            console.log("[resync] Save as draft is enabled. Clicking...");
            await page.locator('button:has-text("Save as draft")').first().click();
            await page.waitForTimeout(4000);
        } else {
            console.log("[resync] Warning: 'Save as draft' button not enabled/found. Trying inline Save...");
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
                console.log("[resync] Clicked inline 'Save' successfully. Waiting 4s...");
                await page.waitForTimeout(4000);
            }
        }

        // 5. Try to click Next
        const reviewBtn = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewBtn.count() > 0) {
            const isEnabled = await reviewBtn.isEnabled();
            console.log(`[resync] Next button isEnabled check: ${isEnabled}`);
            if (isEnabled) {
                console.log("[resync] Clicking 'Next' button...");
                await reviewBtn.click();
                await page.waitForTimeout(6000);
            } else {
                console.log("[resync] Attempting force click on 'Next' button...");
                await reviewBtn.click({ force: true });
                await page.waitForTimeout(6000);
            }
        }

        // Capture final result
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[resync] Saved final dashboard screenshot to: ${finalScreenshot}`);

    } catch (e) {
        console.error("[resync] Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[resync] CDP connection closed.");
    }
}

run();
