import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found.");
            return;
        }

        console.log("Current Page URL:", page.url());

        // Get page warnings/errors text
        const mainContent = await page.evaluate(() => {
            const body = document.querySelector('body');
            return body ? body.innerText.substring(0, 1500) : "";
        });
        console.log("=== Page Text Snippet ===");
        console.log(mainContent);
        console.log("=========================");

        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button')).map(btn => ({
                text: btn.innerText ? btn.innerText.trim() : "",
                visible: btn.getBoundingClientRect().width > 0 && btn.getBoundingClientRect().height > 0,
                disabled: btn.disabled,
                outerHTML: btn.outerHTML.substring(0, 200)
            }));
        });

        console.log("Buttons found on review page:");
        buttons.forEach((btn, idx) => {
            if (btn.visible) {
                console.log(`  Button #${idx}: "${btn.text}" | Disabled: ${btn.disabled} | HTML: ${btn.outerHTML}`);
            }
        });

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
