import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[list-drawer] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // Click "Add assets" in the "App icon" row to make sure it's open
        console.log("[list-drawer] Scroll to 'App icon' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const iconRow = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (iconRow) {
                iconRow.scrollIntoView({ block: "center" });
            }
        });
        await page.waitForTimeout(1000);

        console.log("[list-drawer] Clicking 'Add assets' on 'App icon' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const iconRow = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (iconRow) {
                const btn = iconRow.querySelector("button");
                if (btn) btn.click();
            }
        });
        await page.waitForTimeout(4000);

        // Analyze material-drawer
        const drawerAnalysis = await page.evaluate(() => {
            const drawer = document.querySelector("material-drawer");
            if (!drawer) return { found: false };

            const buttons = Array.from(drawer.querySelectorAll("button")).map(b => ({
                text: b.innerText.trim(),
                ariaLabel: b.getAttribute("aria-label"),
                className: b.className,
                disabled: b.disabled || b.getAttribute("disabled") !== null,
                outerHTML: b.outerHTML.substring(0, 300)
            }));

            // Find all list items, cards, or clickable asset elements in the grid
            const gridItems = Array.from(drawer.querySelectorAll("material-select-item, [role='listitem'], .grid-item, li, [role='option']")).map((item, idx) => ({
                index: idx,
                tagName: item.tagName,
                className: item.className,
                role: item.getAttribute("role"),
                innerText: item.innerText ? item.innerText.replace(/\n/g, " | ") : "",
                outerHTML: item.outerHTML.substring(0, 300)
            }));

            // Check footer / bottom actions
            const footers = Array.from(drawer.querySelectorAll(".footer, .bottom-row, .actions, .bottom-bar")).map(el => ({
                className: el.className,
                innerText: el.innerText ? el.innerText.replace(/\n/g, " | ") : "",
                buttons: Array.from(el.querySelectorAll("button")).map(b => b.innerText.trim())
            }));

            return {
                found: true,
                tagName: drawer.tagName,
                className: drawer.className,
                buttons,
                gridItems,
                footers
            };
        });

        console.log("Drawer Analysis:", JSON.stringify(drawerAnalysis, null, 2));
        writeFileSync(resolve(rootDir, "drawer_analysis.json"), JSON.stringify(drawerAnalysis, null, 2));

    } catch (e) {
        console.error("[list-drawer] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[list-drawer] CDP client disconnected safely.");
    }
}

run();
