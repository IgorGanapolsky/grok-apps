import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("[promote-bot] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        
        if (!page) {
            console.log("[promote-bot] No Play Console page found. Opening a new one...");
            page = await ctx.newPage();
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        const financeUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/finance`;
        console.log(`[promote-bot] Navigating directly to Financial Features: ${financeUrl}`);
        await page.goto(financeUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        // Get inner text of the page to see current settings
        const pageText = await page.evaluate(() => document.body.innerText);
        console.log("\n--- Financial Features Page Content ---");
        const lines = pageText.split("\n");
        for (const line of lines) {
            const l = line.trim();
            if (l.length > 0) {
                console.log(`  > ${l}`);
            }
        }
        console.log("----------------------------------------\n");

        writeFileSync(resolve(rootDir, "financial_features_text.txt"), pageText);

        // Check which checkboxes are checked
        const checkedState = await page.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('mat-checkbox, console-checkbox, input[type="checkbox"]'));
            return checkboxes.map(c => ({
                text: c.textContent.trim(),
                checked: c.checked || c.getAttribute('aria-checked') === 'true' || c.classList.contains('mat-checkbox-checked')
            }));
        });
        console.log("Checkbox states:", JSON.stringify(checkedState, null, 2));

        const screenshotPath = resolve(rootDir, "financial_features_inspect.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[promote-bot] Screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
