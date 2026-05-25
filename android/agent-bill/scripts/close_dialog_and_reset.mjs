import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[cleaner] Connecting to Comet CDP...");
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

        console.log(`[cleaner] Found tab: "${await page.title()}"`);

        // Close dialog
        const closed = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            // Look for Cancel button inside popup or any button with text Cancel
            const cancelBtn = btns.find(b => {
                const txt = b.innerText ? b.innerText.trim() : "";
                const isVisible = b.getBoundingClientRect().height > 0;
                return (txt === "Cancel" || txt === "Dismiss") && isVisible;
            });
            if (cancelBtn) {
                cancelBtn.click();
                return "clicked_cancel_button";
            }

            const closeBtn = btns.find(b => {
                const label = b.getAttribute("aria-label") || "";
                const isVisible = b.getBoundingClientRect().height > 0;
                return label.toLowerCase() === "close" && isVisible;
            });
            if (closeBtn) {
                closeBtn.click();
                return "clicked_close_button";
            }

            return "no_dialog_buttons_found";
        });

        console.log(`[cleaner] Dialog close action: ${closed}`);
        await page.waitForTimeout(3000);

        // Take verification screenshot
        const cleanScreenshot = resolve(rootDir, "current_tab_cleaned.png");
        await page.screenshot({ path: cleanScreenshot });
        console.log(`[cleaner] Saved clean page screenshot to: ${cleanScreenshot}`);

    } catch (e) {
        console.error("[cleaner] Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
