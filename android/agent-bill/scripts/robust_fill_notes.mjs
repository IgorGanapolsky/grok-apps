import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[robust] Connecting to Comet CDP...");
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

        console.log(`[robust] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Fill Release Name
        console.log("[robust] Locating Release name input...");
        const releaseNameInput = page.locator('input[aria-label="Release name"]').first();
        if (await releaseNameInput.count() > 0) {
            console.log("[robust] Filling Release name with '3 (0.1.2)'...");
            await releaseNameInput.fill("");
            await page.waitForTimeout(500);
            await releaseNameInput.fill("3 (0.1.2)");
            await page.waitForTimeout(500);
        }

        // 2. Clear and fill Release Notes with proper tags
        console.log("[robust] Locating Release notes textarea...");
        const textarea = page.locator('textarea[aria-label="Release notes"], textarea').first();
        if (await textarea.count() > 0) {
            console.log("[robust] Focusing textarea...");
            await textarea.focus();
            await page.waitForTimeout(500);

            console.log("[robust] Emptying textarea via fill('')...");
            await textarea.fill("");
            await page.waitForTimeout(1000);

            console.log("[robust] Filling textarea with formatted locale notes...");
            const notesText = "<en-US>AgentBill v0.1.2 - Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.</en-US>";
            await textarea.fill(notesText);
            await page.waitForTimeout(1000);

            console.log("[robust] Blurring textarea...");
            await page.evaluate(() => {
                const ta = document.querySelector('textarea[aria-label="Release notes"]');
                if (ta) ta.blur();
            });
            await page.waitForTimeout(4000); // Give validator 4 seconds to parse
        }

        // Capture verification screenshot
        const filledScreenshot = resolve(rootDir, "current_tab_robust_filled.png");
        await page.screenshot({ path: filledScreenshot });
        console.log(`[robust] Saved robust-filled state screenshot to: ${filledScreenshot}`);

        // 3. Inspect errors and button states in DOM
        const state = await page.evaluate(() => {
            const errs = Array.from(document.querySelectorAll(".error, [role='alert'], .mdc-text-field--invalid")).map(el => el.innerText).filter(Boolean);
            const btns = Array.from(document.querySelectorAll("button")).map(b => ({
                text: b.innerText ? b.innerText.trim() : "",
                enabled: !b.disabled && b.getAttribute("aria-disabled") !== "true"
            }));
            const textareaValue = document.querySelector('textarea[aria-label="Release notes"]')?.value || "";
            return { errs, btns, textareaValue };
        });

        console.log("\n--- POST-FILL DOM STATE ---");
        console.log("Validation Errors:", state.errs);
        console.log("Textarea Value:", `"${state.textareaValue}"`);
        
        const saveBtnInfo = state.btns.find(b => b.text === "Save");
        console.log("Card 'Save' button exists and is enabled:", saveBtnInfo);
        
        const saveDraftBtnInfo = state.btns.find(b => b.text === "Save as draft");
        console.log("Footer 'Save as draft' button exists and is enabled:", saveDraftBtnInfo);

        const nextBtnInfo = state.btns.find(b => b.text === "Next");
        console.log("Footer 'Next' button exists and is enabled:", nextBtnInfo);
        console.log("---------------------------\n");

        // 4. Click Card Save Button
        console.log("[robust] Finding and clicking the inline 'Save' button...");
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
            console.log("[robust] Clicked inline 'Save' button successfully! Waiting 5s...");
            await page.waitForTimeout(5000);
        } else {
            console.log("[robust] Inline 'Save' button was not clickable or enabled. Checking if we can click global Save as draft...");
        }

        // 5. Click global Next/Review button
        const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewButton.count() > 0) {
            const isEnabled = await reviewButton.isEnabled();
            console.log(`[robust] Global 'Next' button isEnabled: ${isEnabled}`);
            console.log("[robust] Clicking global 'Next' button...");
            await reviewButton.click();
            await page.waitForTimeout(6000);
        }

        // Capture final rollout dashboard page
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[robust] Saved rollout dashboard screenshot to: ${finalScreenshot}`);

    } catch (e) {
        console.error("[robust] Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[robust] CDP connection closed.");
    }
}

run();
