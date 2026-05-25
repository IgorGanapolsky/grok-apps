import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[diag-library] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // Scroll App Icon into view and click 'Add assets'
        console.log("[diag-library] Scrolling App Icon into view...");
        await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
            if (el) el.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(2000);

        console.log("[diag-library] Clicking 'Add assets' for App Icon...");
        await page.evaluate(() => {
            const row = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
            const btn = row.querySelector("button");
            if (btn) btn.click();
        });
        await page.waitForTimeout(4000);

        await page.screenshot({ path: resolve(rootDir, "asset_library_open.png") });
        console.log("[diag-library] Saved asset_library_open.png");

        // Inspect side panel DOM
        const panelInfo = await page.evaluate(() => {
            const panel = document.querySelector("aside, div.drawer, div.side-panel, div[role='dialog'], .drawer-content, .drawer-container");
            // If we can't find direct side panel tags, search globally for drawer-like classes
            const allElements = Array.from(document.querySelectorAll("*"));
            const drawer = allElements.find(el => el.className && (el.className.includes("drawer") || el.className.includes("panel") || el.className.includes("aside") || el.className.includes("modal")));

            if (!drawer) return { error: "No drawer/panel element found in DOM." };

            const buttons = Array.from(drawer.querySelectorAll("button")).map(btn => ({
                text: btn.textContent ? btn.textContent.trim() : "",
                className: btn.className,
                ariaLabel: btn.getAttribute("aria-label"),
                outerHTML: btn.outerHTML.substring(0, 300)
            }));

            const listItems = Array.from(drawer.querySelectorAll("li, [role='listitem'], .grid-item, .asset-item")).map((li, idx) => ({
                index: idx,
                tagName: li.tagName,
                className: li.className,
                text: li.textContent ? li.textContent.trim().substring(0, 150) : "",
                outerHTML: li.outerHTML.substring(0, 300)
            }));

            // Search for input files inside drawer
            const inputs = Array.from(drawer.querySelectorAll("input")).map(inp => ({
                type: inp.type,
                accept: inp.accept,
                className: inp.className,
                outerHTML: inp.outerHTML
            }));

            return {
                drawerTag: drawer.tagName,
                drawerClass: drawer.className,
                buttons,
                listItems,
                inputs
            };
        });

        writeFileSync(resolve(rootDir, "asset_library_details.json"), JSON.stringify(panelInfo, null, 2));
        console.log("[diag-library] Dumped asset library details to asset_library_details.json");

    } catch (e) {
        console.error("[diag-library] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[diag-library] CDP client disconnected.");
    }
}

run();
