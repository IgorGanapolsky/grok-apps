import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[close-spec] Connecting to Comet CDP...");
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

        console.log(`[close-spec] Found tab: "${await page.title()}"`);

        // Close using page.evaluate to find the specific button inside the dialog
        const result = await page.evaluate(() => {
            const dialog = document.querySelector('div[role="dialog"], .popup, mat-dialog-container');
            if (!dialog) {
                return { success: false, msg: "No dialog found." };
            }

            const buttons = Array.from(dialog.querySelectorAll('button'));
            const cancelBtn = buttons.find(b => b.innerText && b.innerText.trim().includes("Cancel"));
            if (cancelBtn) {
                cancelBtn.click();
                return { success: true, clicked: "Cancel button", html: cancelBtn.outerHTML };
            }

            const closeBtn = buttons.find(b => {
                const label = b.getAttribute("aria-label") || "";
                return label.toLowerCase() === "close" || (b.innerText && b.innerText.trim().toLowerCase().includes("close"));
            });
            if (closeBtn) {
                closeBtn.click();
                return { success: true, clicked: "Close button", html: closeBtn.outerHTML };
            }

            return { success: false, msg: "Could not find Cancel or Close button inside dialog.", buttons: buttons.map(b => b.innerText) };
        });

        console.log("[close-spec] Result:", result);
        await page.waitForTimeout(3000);

        // Verification screenshot
        const screenshotPath = resolve(rootDir, "current_tab_cleaned.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[close-spec] Saved screenshot to: ${screenshotPath}`);

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[close-spec] CDP connection closed.");
    }
}

run();
