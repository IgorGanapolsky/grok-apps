import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

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

        console.log("Clicking 'Add countries / regions' button...");
        const addBtn = page.locator('button:has-text("Add countries / regions")').first();
        if (await addBtn.count() > 0) {
            await addBtn.click();
            await page.waitForTimeout(4000);
        } else {
            console.log("Button NOT found!");
        }

        const screenshotPath = resolve(rootDir, "add_countries_modal.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Dump elements in the active drawer/modal
        const elements = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input, mat-checkbox, [role="checkbox"]')).map(el => ({
                tagName: el.tagName.toLowerCase(),
                type: el.getAttribute("type") || "",
                ariaLabel: el.getAttribute("aria-label") || "",
                checked: el.checked || el.getAttribute("aria-checked") || "",
                innerText: el.innerText ? el.innerText.trim() : "",
                outerHTML: el.outerHTML.substring(0, 300)
            }));
            const buttons = Array.from(document.querySelectorAll('button')).map(el => ({
                text: el.innerText ? el.innerText.trim() : "",
                enabled: !el.disabled
            }));
            return { inputs, buttons, text: document.body.innerText };
        });

        console.log("\n--- DETECTED INPUTS ---");
        console.log(JSON.stringify(elements.inputs, null, 2));
        console.log("-----------------------\n");

        console.log("\n--- DETECTED BUTTONS ---");
        console.log(JSON.stringify(elements.buttons, null, 2));
        console.log("------------------------\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
