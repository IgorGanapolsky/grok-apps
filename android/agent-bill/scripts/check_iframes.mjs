import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[check-iframes] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // List all iframes and search for inputs inside them
        const iframeInfo = await page.evaluate(() => {
            const iframes = Array.from(document.querySelectorAll("iframe"));
            return iframes.map((iframe, idx) => {
                let inputsCount = 0;
                let fileInputsCount = 0;
                let src = iframe.src;
                let title = iframe.title;
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    if (doc) {
                        inputsCount = doc.querySelectorAll("input").length;
                        fileInputsCount = doc.querySelectorAll("input[type='file']").length;
                    }
                } catch (e) {
                    src = src + " (Cross-origin access blocked: " + e.message + ")";
                }
                return { index: idx, src, title, inputsCount, fileInputsCount };
            });
        });

        console.log("[check-iframes] Iframes found on page:", JSON.stringify(iframeInfo, null, 2));

    } catch (e) {
        console.error("[check-iframes] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[check-iframes] CDP client disconnected.");
    }
}

run();
