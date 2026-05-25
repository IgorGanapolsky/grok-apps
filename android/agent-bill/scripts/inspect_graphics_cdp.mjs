import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[graphics-cdp] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        console.log("[graphics-cdp] Inspecting form rows...");
        const rowsInfo = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row, .console-form-row, section, div[role='region']"));
            return rows.map((row, idx) => {
                const text = row.innerText ? row.innerText.substring(0, 150).replace(/\n/g, " | ") : "";
                const buttons = Array.from(row.querySelectorAll("button")).map(btn => ({
                    text: btn.innerText.trim(),
                    outerHTML: btn.outerHTML.substring(0, 200)
                }));
                const inputs = Array.from(row.querySelectorAll("input")).map(inp => ({
                    type: inp.type,
                    outerHTML: inp.outerHTML.substring(0, 200)
                }));
                return {
                    index: idx,
                    tagName: row.tagName,
                    className: row.className,
                    text,
                    buttons,
                    inputs
                };
            }).filter(r => r.text.includes("App icon") || r.text.includes("Feature graphic") || r.text.includes("screenshots") || r.text.includes("Add assets"));
        });

        console.log("Form Rows found containing assets words:", JSON.stringify(rowsInfo, null, 2));

    } catch (e) {
        console.error("[graphics-cdp] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[graphics-cdp] CDP client disconnected safely.");
    }
}

run();
