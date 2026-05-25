import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[direct-cancel] Connecting to Comet CDP...");
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

        console.log(`[direct-cancel] Found tab: "${await page.title()}"`);

        // Find and click the Cancel button or Close button directly on the page
        const result = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            
            // 1. Try Close button by aria-label
            const closeIcon = btns.find(b => {
                const label = b.getAttribute("aria-label") || "";
                return label.toLowerCase() === "close" && b.getBoundingClientRect().height > 0;
            });
            if (closeIcon) {
                closeIcon.click();
                return { clicked: "Close icon button by aria-label", html: closeIcon.outerHTML };
            }

            // 2. Try Cancel button in dialog
            const cancelBtn = btns.find(b => {
                const txt = b.innerText ? b.innerText.trim() : "";
                // We want to make sure it's the Cancel button of the dialog, which is usually a submit or mdc-button
                return txt === "Cancel" && b.getBoundingClientRect().height > 0;
            });
            if (cancelBtn) {
                cancelBtn.click();
                return { clicked: "Cancel button by innerText", html: cancelBtn.outerHTML };
            }

            // 3. Try close button by text
            const closeTextBtn = btns.find(b => {
                const txt = b.innerText ? b.innerText.trim().toLowerCase() : "";
                return txt === "close" && b.getBoundingClientRect().height > 0;
            });
            if (closeTextBtn) {
                closeTextBtn.click();
                return { clicked: "Close button by text", html: closeTextBtn.outerHTML };
            }

            return { clicked: "none", msg: "No Cancel or Close buttons found.", buttons: btns.map(b => b.innerText).filter(Boolean) };
        });

        console.log("[direct-cancel] Result:", result);
        await page.waitForTimeout(3000);

        // Verification screenshot
        const screenshotPath = resolve(rootDir, "current_tab_cleaned.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[direct-cancel] Saved screenshot to: ${screenshotPath}`);

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[direct-cancel] CDP connection closed.");
    }
}

run();
