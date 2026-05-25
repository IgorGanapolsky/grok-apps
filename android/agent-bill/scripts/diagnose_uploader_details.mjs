import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[diag-uploader] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        console.log(`[diag-uploader] Active page title: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // Scroll App Icon into view
        await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
            if (el) el.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(2000);

        // Analyze elements inside the App Icon container
        const details = await page.evaluate(() => {
            const row = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
            if (!row) return { error: "Row not found" };

            // Find all elements inside row
            const allElements = Array.from(row.querySelectorAll("*")).map((el, idx) => ({
                index: idx,
                tagName: el.tagName,
                className: el.className,
                id: el.id,
                text: el.innerText ? el.innerText.trim().substring(0, 100) : "",
                outerHTML: el.outerHTML.substring(0, 200) + "..."
            }));

            // Find if there are any hidden inputs, dropzones, or iframes
            const inputs = Array.from(row.querySelectorAll("input")).map(inp => ({
                tagName: inp.tagName,
                type: inp.type,
                className: inp.className,
                id: inp.id,
                accept: inp.accept,
                outerHTML: inp.outerHTML
            }));

            return { allElements, inputs };
        });

        writeFileSync(resolve(rootDir, "uploader_details.json"), JSON.stringify(details, null, 2));
        console.log("[diag-uploader] Dumped to uploader_details.json");

    } catch (e) {
        console.error("[diag-uploader] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[diag-uploader] CDP client disconnected.");
    }
}

run();
