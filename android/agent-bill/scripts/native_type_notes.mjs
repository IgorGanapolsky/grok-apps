import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[typist] Connecting to Comet CDP...");
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

        console.log(`[typist] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Press Escape to clear any active dropdown select popups
        console.log("[typist] Pressing Escape key multiple times to clear popups...");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);

        // 2. Set Release Name
        console.log("[typist] Setting Release name...");
        const releaseName = page.locator('input[aria-label="Release name"]').first();
        if (await releaseName.count() > 0) {
            await releaseName.focus();
            await page.keyboard.press("Meta+A");
            await page.keyboard.press("Backspace");
            await page.keyboard.type("3 (0.1.2)");
            await page.waitForTimeout(500);
        }

        // 3. Select and clear Release Notes textarea natively
        console.log("[typist] Locating and focusing Release Notes textarea...");
        const textarea = page.locator('textarea[aria-label="Release notes"], textarea').first();
        if (await textarea.count() > 0) {
            await textarea.focus();
            await page.waitForTimeout(500);

            // Select all and clear
            console.log("[typist] Clearing textarea via keyboard shortcuts...");
            await page.keyboard.press("Meta+A");
            await page.keyboard.press("Backspace");
            await page.waitForTimeout(1000);

            // Type character by character
            const notesText = "<en-US>AgentBill v0.1.2 - Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.</en-US>";
            console.log(`[typist] Natively typing notes text: "${notesText}"`);
            await page.keyboard.type(notesText, { delay: 30 }); // 30ms delay between keystrokes to mimic human speed and ensure correct event order
            await page.waitForTimeout(2000);

            console.log("[typist] Blurring textarea...");
            await page.evaluate(() => {
                const ta = document.querySelector('textarea[aria-label="Release notes"]');
                if (ta) ta.blur();
            });
            await page.waitForTimeout(4000); // Wait for validator to digest
        } else {
            console.log("[typist] Textarea not found!");
        }

        // Capture screenshot of page state
        const screenshotPath = resolve(rootDir, "current_tab_after_typing.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[typist] Saved typed state screenshot to: ${screenshotPath}`);

        // 4. Check DOM status
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

        console.log("\n--- POST-TYPE DOM STATE ---");
        console.log("Validation Errors:", state.errs);
        console.log("Textarea Value:", `"${state.textareaValue}"`);
        
        const saveBtn = state.btns.find(b => b.text === "Save as draft");
        console.log("Save as draft button state:", saveBtn);

        const nextBtn = state.btns.find(b => b.text === "Next");
        console.log("Next button state:", nextBtn);
        console.log("---------------------------\n");

        // 5. If Save as draft is enabled, click it
        if (saveBtn && saveBtn.enabled) {
            console.log("[typist] Clicking 'Save as draft'...");
            await page.locator('button:has-text("Save as draft")').first().click();
            await page.waitForTimeout(5000);
        } else {
            console.log("[typist] Save as draft not enabled. Attempting inline Save...");
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
                console.log("[typist] Clicked inline 'Save' successfully. Waiting 5s...");
                await page.waitForTimeout(5000);
            }
        }

        // 6. Click Next if enabled
        const reviewBtn = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewBtn.count() > 0) {
            const isEnabled = await reviewBtn.isEnabled();
            console.log(`[typist] Next button isEnabled check: ${isEnabled}`);
            if (isEnabled) {
                console.log("[typist] Clicking 'Next' button...");
                await reviewBtn.click();
                await page.waitForTimeout(6000);
            } else {
                console.log("[typist] Attempting force click on 'Next' button...");
                await reviewBtn.click({ force: true });
                await page.waitForTimeout(6000);
            }
        }

        // Capture final rollout page
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[typist] Saved final rollout dashboard screenshot to: ${finalScreenshot}`);

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[typist] CDP connection closed.");
    }
}

run();
