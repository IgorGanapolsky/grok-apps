import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[click-add] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // Force close any existing drawer / modal
        console.log("[click-add] Closing open drawer / modal if any...");
        await page.evaluate(() => {
            // Click any close button
            const closeButtons = Array.from(document.querySelectorAll("aside button, [role='dialog'] button, .drawer button")).filter(b => {
                const txt = b.innerText ? b.innerText.toLowerCase() : "";
                const aria = b.getAttribute("aria-label") ? b.getAttribute("aria-label").toLowerCase() : "";
                return txt.includes("close") || aria.includes("close");
            });
            closeButtons.forEach(b => b.click());
        });
        await page.waitForTimeout(2000);

        // Click "Add assets" in the "App icon" row (row index 3)
        console.log("[click-add] Scrolling 'App icon' row into view...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const iconRow = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (iconRow) {
                iconRow.scrollIntoView({ block: "center" });
            }
        });
        await page.waitForTimeout(1000);

        console.log("[click-add] Clicking 'Add assets' on 'App icon' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const iconRow = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (iconRow) {
                const btn = iconRow.querySelector("button");
                if (btn) btn.click();
            }
        });
        
        console.log("[click-add] Waiting 6 seconds for drawer to open...");
        await page.waitForTimeout(6000);

        // Take a screenshot
        const screenshotPath = resolve(rootDir, "drawer_open_inspect.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[click-add] Screenshot saved to ${screenshotPath}`);

        // Search the entire DOM for the word "Upload" or new elements
        const domInfo = await page.evaluate(() => {
            // Find all visible elements or dialogs
            const allElements = Array.from(document.querySelectorAll("*"));
            
            // Look for any dialogs, asides, modals, drawers
            const structuralElements = allElements.filter(el => {
                const tagName = el.tagName.toLowerCase();
                const role = el.getAttribute("role");
                const className = el.className ? String(el.className) : "";
                return tagName === "aside" || role === "dialog" || className.includes("drawer") || className.includes("modal") || className.includes("dialog");
            }).map(el => ({
                tagName: el.tagName,
                role: el.getAttribute("role"),
                className: el.className,
                innerTextSummary: el.innerText ? el.innerText.substring(0, 200).replace(/\n/g, " | ") : "",
                outerHTMLHeader: el.outerHTML.substring(0, 300)
            }));

            // Find all elements containing text "Upload" or "upload"
            const uploadElements = allElements.filter(el => {
                if (el.children.length > 0) return false; // leaf nodes only
                const txt = el.innerText || el.textContent || "";
                return txt.toLowerCase().includes("upload");
            }).map(el => ({
                tagName: el.tagName,
                className: el.className,
                text: (el.innerText || el.textContent || "").trim(),
                outerHTML: el.outerHTML.substring(0, 300)
            }));

            // Find all inputs (especially file inputs)
            const inputs = Array.from(document.querySelectorAll("input")).map(i => ({
                type: i.type,
                id: i.id,
                className: i.className,
                accept: i.getAttribute("accept"),
                outerHTML: i.outerHTML.substring(0, 300)
            }));

            // Find all buttons anywhere
            const buttons = Array.from(document.querySelectorAll("button")).map(b => ({
                text: b.innerText.trim(),
                ariaLabel: b.getAttribute("aria-label"),
                outerHTML: b.outerHTML.substring(0, 200)
            })).filter(b => b.text.toLowerCase().includes("upload") || b.text.toLowerCase().includes("select") || b.text.toLowerCase().includes("add") || b.text.toLowerCase().includes("save"));

            return {
                structuralElements,
                uploadElements,
                inputs,
                buttons
            };
        });

        console.log("DOM INFO AFTER CLICKING 'Add assets':", JSON.stringify(domInfo, null, 2));

    } catch (e) {
        console.error("[click-add] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[click-add] CDP client disconnected safely.");
    }
}

run();
