import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[click-select] Connecting to Comet on remote debugging port 9222...");
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
        console.log("[click-select] Opening drawer...");
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

        // Find the ASSET-LIST-ROW containing "icon_512.png" and "512x512px", and click its select-button
        console.log("[click-select] Locating and clicking the select-button for 512x512 icon asset...");
        const clicked = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            const targetRow = rows.find(r => {
                const text = r.innerText || "";
                return text.includes("icon_512.png") && text.includes("512x512");
            });

            if (targetRow) {
                const selectBtn = targetRow.querySelector('a[debug-id="select-button"]');
                if (selectBtn) {
                    selectBtn.click();
                    return { success: true, text: targetRow.innerText };
                }
                return { success: false, error: "select-button not found inside targetRow" };
            }
            return { success: false, error: "targetRow not found" };
        });

        console.log("[click-select] Click result:", clicked);
        await page.waitForTimeout(3000);

        // Dump the entire text contents of the drawer and its structure
        const drawerTextsAndElements = await page.evaluate(() => {
            const drawer = document.querySelector("material-drawer");
            if (!drawer) return { found: false };

            const text = drawer.innerText || "";

            // Find all clickable elements
            const clickables = Array.from(drawer.querySelectorAll("button, [role='button'], a, .button, .btn, [focusableelement]")).map(el => ({
                tagName: el.tagName,
                className: el.className,
                text: el.innerText ? el.innerText.trim().replace(/\n/g, " | ") : "",
                outerHTML: el.outerHTML.substring(0, 300)
            }));

            return {
                found: true,
                innerTextSummary: text.substring(0, 500).replace(/\n/g, " | "),
                clickables
            };
        });

        console.log("Drawer details after selection click:", JSON.stringify(drawerTextsAndElements, null, 2));

    } catch (e) {
        console.error("[click-select] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[click-select] CDP client disconnected safely.");
    }
}

run();
