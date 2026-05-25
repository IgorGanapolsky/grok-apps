import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[copy-notes] Connecting to Comet CDP...");
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

        console.log(`[copy-notes] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Locate and click "Copy from a previous release"
        console.log("[copy-notes] Locating 'Copy from a previous release' button...");
        const clicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            const copyBtn = btns.find(b => b.innerText && b.innerText.trim() === "Copy from a previous release");
            if (copyBtn) {
                copyBtn.click();
                return true;
            }
            return false;
        });

        if (clicked) {
            console.log("[copy-notes] Clicked 'Copy from a previous release' button. Waiting 5s for data transfer...");
            await page.waitForTimeout(5000);
        } else {
            console.log("[copy-notes] Warning: 'Copy from a previous release' button not found.");
        }

        // Capture screenshot after copy
        const copyScreenshot = resolve(rootDir, "current_tab_after_copy_previous.png");
        await page.screenshot({ path: copyScreenshot });
        console.log(`[copy-notes] Saved screenshot to: ${copyScreenshot}`);

        // 2. Dump state to verify if errors are cleared
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
        
        const saveBtn = state.btns.find(b => b.text === "Save");
        console.log("Card 'Save' button isEnabled:", saveBtn);
        
        const nextBtn = state.btns.find(b => b.text === "Next");
        console.log("Footer 'Next' button isEnabled:", nextBtn);
        console.log("---------------------------\n");

    } catch (e) {
        console.error("[copy-notes] Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[copy-notes] CDP connection closed.");
    }
}

run();
