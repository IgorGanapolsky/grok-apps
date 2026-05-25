import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[click-asset] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // Scroll to 'App icon' row and click 'Add assets'
        console.log("[click-asset] Opening drawer...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const iconRow = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (iconRow) {
                iconRow.scrollIntoView({ block: "center" });
                const btn = iconRow.querySelector("button");
                if (btn) btn.click();
            }
        });
        await page.waitForTimeout(4000);

        // Click the first ASSET-LIST-ROW containing "icon_512.png" and "512x512px"
        console.log("[click-asset] Locating and clicking the 512x512 icon asset...");
        const clicked = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            const targetRow = rows.find(r => {
                const text = r.innerText || "";
                return text.includes("icon_512.png") && text.includes("512x512");
            });

            if (targetRow) {
                const clickable = targetRow.querySelector(".list-row-container") || targetRow;
                clickable.click();
                return { success: true, text: targetRow.innerText };
            }
            return { success: false };
        });

        console.log("[click-asset] Click result:", clicked);
        await page.waitForTimeout(3000);

        // Capture screenshot after clicking
        const screenshotPath = resolve(rootDir, "drawer_after_click_asset.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[click-asset] Screenshot saved to ${screenshotPath}`);

        // Check if new buttons appeared or became enabled anywhere on the page
        const pageButtons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("button")).map(b => ({
                text: b.innerText.trim(),
                ariaLabel: b.getAttribute("aria-label"),
                disabled: b.disabled || b.getAttribute("disabled") !== null,
                className: b.className,
                outerHTML: b.outerHTML.substring(0, 200)
            })).filter(b => b.text.length > 0);
        });

        console.log("[click-asset] Buttons on page after click:", JSON.stringify(pageButtons, null, 2));

    } catch (e) {
        console.error("[click-asset] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[click-asset] CDP client disconnected safely.");
    }
}

run();
