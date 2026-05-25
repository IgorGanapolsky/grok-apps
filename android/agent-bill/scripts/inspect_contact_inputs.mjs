import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[promote-bot] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("store-settings"));
        
        if (!page) {
            console.error("Error: Play Store Settings page not found.");
            return;
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        // Let's inspect the input elements currently visible in the DOM
        const inputsDetails = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("input, select, textarea")).map((el, i) => {
                // Get ancestor text
                let parent = el.parentElement;
                let ancestorTexts = [];
                for (let depth = 0; depth < 5; depth++) {
                    if (!parent) break;
                    if (parent.innerText && parent.innerText.trim()) {
                        ancestorTexts.push(`[depth ${depth}]: ${parent.innerText.trim().slice(0, 100).replace(/\n/g, ' ')}`);
                    }
                    parent = parent.parentElement;
                }
                return {
                    index: i,
                    tagName: el.tagName,
                    type: el.type,
                    id: el.id,
                    className: el.className,
                    placeholder: el.placeholder,
                    value: el.value,
                    outerHTML: el.outerHTML,
                    ancestors: ancestorTexts
                };
            });
        });

        console.log("[promote-bot] Found inputs:", JSON.stringify(inputsDetails, null, 2));
        writeFileSync(resolve(rootDir, "contact_inputs_inspect.json"), JSON.stringify(inputsDetails, null, 2));

        // Take a screenshot of what's currently on screen
        await page.screenshot({ path: resolve(rootDir, "contact_inspect_state.png") });
        console.log("[promote-bot] Screenshot saved as contact_inspect_state.png");

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
