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

        // --- 1. Government Apps ---
        const govUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/government-apps`;
        console.log(`[promote-bot] Navigating directly to Government Apps: ${govUrl}`);
        await page.goto(govUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        const govText = await page.evaluate(() => document.body.innerText);
        writeFileSync(resolve(rootDir, "government_apps_inspect_text.txt"), govText);

        const govRadioState = await page.evaluate(() => {
            const radios = Array.from(document.querySelectorAll('mat-radio-button, console-radio-button, [role="radio"]'));
            return radios.map(r => ({
                text: r.textContent.trim(),
                checked: r.checked || r.getAttribute('aria-checked') === 'true' || r.classList.contains('mat-radio-checked') || r.classList.contains('console-radio-button-checked')
            }));
        });
        console.log("Government Apps Radio states:", JSON.stringify(govRadioState, null, 2));
        await page.screenshot({ path: resolve(rootDir, "government_apps_inspect.png") });

        // --- 2. Health Apps ---
        const healthUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/health`;
        console.log(`[promote-bot] Navigating directly to Health Apps: ${healthUrl}`);
        await page.goto(healthUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        const healthText = await page.evaluate(() => document.body.innerText);
        writeFileSync(resolve(rootDir, "health_apps_inspect_text.txt"), healthText);

        const healthCheckboxState = await page.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('mat-checkbox, console-checkbox, input[type="checkbox"]'));
            return checkboxes.map(c => ({
                text: c.textContent.trim(),
                checked: c.checked || c.getAttribute('aria-checked') === 'true' || c.classList.contains('mat-checkbox-checked') || c.classList.contains('console-checkbox-checked')
            }));
        });
        console.log("Health Apps Checkbox states:", JSON.stringify(healthCheckboxState, null, 2));
        await page.screenshot({ path: resolve(rootDir, "health_apps_inspect.png") });

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
