import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[close-all] Connecting to Comet CDP...");
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

        console.log(`[close-all] Found tab: "${await page.title()}"`);

        // Close using page.evaluate to repeatedly find and click Close / Cancel / Dismiss buttons
        const actionResult = await page.evaluate(async () => {
            let actions = [];
            for (let attempt = 0; attempt < 5; attempt++) {
                const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], .popup, mat-dialog-container'));
                if (dialogs.length === 0) {
                    actions.push("No dialogs visible");
                    break;
                }

                // 1. Try finding close icon button (aria-label="Close")
                const closeIconBtn = document.querySelector('button[aria-label="Close"], button.close-icon-button, [icon="close"] button');
                if (closeIconBtn && closeIconBtn.getBoundingClientRect().height > 0) {
                    closeIconBtn.click();
                    actions.push(`Clicked Close icon button: ${closeIconBtn.outerHTML.substring(0, 100)}`);
                    await new Promise(r => setTimeout(r, 1500));
                    continue;
                }

                // 2. Try finding Cancel button
                const buttons = Array.from(document.querySelectorAll('button'));
                const cancelBtn = buttons.find(b => {
                    const txt = b.innerText ? b.innerText.trim() : "";
                    const isVisible = b.getBoundingClientRect().height > 0;
                    return (txt === "Cancel" || txt === "Discard") && isVisible;
                });
                if (cancelBtn) {
                    cancelBtn.click();
                    actions.push(`Clicked Cancel button: ${cancelBtn.outerHTML.substring(0, 100)}`);
                    await new Promise(r => setTimeout(r, 1500));
                    continue;
                }

                // 3. Try finding Dismiss button
                const dismissBtn = buttons.find(b => {
                    const txt = b.innerText ? b.innerText.trim() : "";
                    const isVisible = b.getBoundingClientRect().height > 0;
                    return txt === "Dismiss" && isVisible;
                });
                if (dismissBtn) {
                    dismissBtn.click();
                    actions.push(`Clicked Dismiss button: ${dismissBtn.outerHTML.substring(0, 100)}`);
                    await new Promise(r => setTimeout(r, 1500));
                    continue;
                }

                actions.push("Found dialog but could not find standard close buttons.");
                break;
            }
            return actions;
        });

        console.log("[close-all] Actions performed:", actionResult);

        // Verification screenshot
        const screenshotPath = resolve(rootDir, "current_tab_cleaned.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[close-all] Saved screenshot to: ${screenshotPath}`);

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[close-all] CDP connection closed.");
    }
}

run();
