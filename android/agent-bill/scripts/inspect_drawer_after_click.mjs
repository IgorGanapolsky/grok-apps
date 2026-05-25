import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[inspect-after-click] Connecting to Comet on remote debugging port 9222...");
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
        console.log("[inspect-after-click] Opening drawer...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const iconRow = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (iconRow) {
                iconRow.scrollIntoView({ block: "center" });
                const btn = iconRow.querySelector("button");
                if (btn) btn.click();
            }
        });
        await page.waitForTimeout(3000);

        // Click the first ASSET-LIST-ROW containing "icon_512.png" and "512x512px"
        console.log("[inspect-after-click] Locating and clicking the 512x512 icon asset...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            const targetRow = rows.find(r => {
                const text = r.innerText || "";
                return text.includes("icon_512.png") && text.includes("512x512");
            });

            if (targetRow) {
                const clickable = targetRow.querySelector(".list-row-container") || targetRow;
                clickable.click();
            }
        });
        await page.waitForTimeout(2000);

        // Dump the entire text contents of the drawer and its structure
        const drawerTextsAndElements = await page.evaluate(() => {
            const drawer = document.querySelector("material-drawer");
            if (!drawer) return { found: false };

            const text = drawer.innerText || "";
            const html = drawer.outerHTML || "";

            // Find all clickable-looking elements in the drawer
            const clickables = Array.from(drawer.querySelectorAll("button, [role='button'], a, .button, .btn, [focusableelement], material-select-item")).map(el => ({
                tagName: el.tagName,
                className: el.className,
                text: el.innerText ? el.innerText.trim().replace(/\n/g, " | ") : "",
                outerHTML: el.outerHTML.substring(0, 300)
            }));

            // Let's find any element that has text "Use", "Select", "Choose", "Save", "Apply", or "Done" inside the drawer
            const actionElements = Array.from(drawer.querySelectorAll("*")).filter(el => {
                if (el.children.length > 0) return false;
                const txt = el.innerText || el.textContent || "";
                return txt.includes("Use") || txt.includes("Select") || txt.includes("Choose") || txt.includes("Save") || txt.includes("Apply") || txt.includes("Done");
            }).map(el => ({
                tagName: el.tagName,
                className: el.className,
                text: (el.innerText || el.textContent || "").trim(),
                outerHTML: el.outerHTML.substring(0, 200)
            }));

            return {
                found: true,
                innerText: text,
                clickables,
                actionElements
            };
        });

        console.log("Drawer details after selection click:", JSON.stringify(drawerTextsAndElements, null, 2));

    } catch (e) {
        console.error("[inspect-after-click] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[inspect-after-click] CDP client disconnected safely.");
    }
}

run();
