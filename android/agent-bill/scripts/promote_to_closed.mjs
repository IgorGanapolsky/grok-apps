import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const INTERNAL_TESTING_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/tracks/internal-testing`;

async function run() {
    console.log("[promote-closed] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) page = await ctx.newPage();

        await page.setViewportSize({ width: 1440, height: 900 });

        console.log(`[promote-closed] Navigating to: ${INTERNAL_TESTING_URL}`);
        await page.goto(INTERNAL_TESTING_URL, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        console.log("[promote-closed] Finding 'Promote release' button...");
        const promoteBtn = page.locator('button:has-text("Promote release")').first();
        if (await promoteBtn.count() === 0) {
            throw new Error("Promote release button not found.");
        }

        console.log("[promote-closed] Clicking 'Promote release' button...");
        await promoteBtn.click();
        await page.waitForTimeout(2000);

        console.log("[promote-closed] Hovering over 'Closed testing' item...");
        const closedItem = page.locator('material-select-item:has-text("Closed testing")').first();
        if (await closedItem.count() === 0) {
            throw new Error("Closed testing menu item not found.");
        }
        await closedItem.hover();
        await page.waitForTimeout(2000);

        console.log("[promote-closed] Clicking 'Closed testing - Alpha' item...");
        const alphaItem = page.locator('button:has-text("Closed testing - Alpha"), [role="menuitem"]:has-text("Closed testing - Alpha"), material-select-item:has-text("Closed testing - Alpha")').first();
        if (await alphaItem.count() === 0) {
            console.log("[promote-closed] Alpha item locator fallback...");
            await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('material-select-item, button, [role="menuitem"]'));
                const alpha = els.find(el => el.innerText && el.innerText.includes("Closed testing - Alpha"));
                if (alpha) alpha.click();
            });
        } else {
            await alphaItem.click();
        }
        await page.waitForTimeout(6000);

        console.log(`[promote-closed] Navigated page title: "${await page.title()}"`);
        console.log(`[promote-closed] Navigated page URL: ${page.url()}`);

        const screenshotPath = resolve(rootDir, "promote_closed_staged.png");
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[promote-closed] Screenshot saved to ${screenshotPath}`);

        // Analyze page status
        const analysis = await page.evaluate(() => {
            const heading = document.querySelector('h1, h2')?.innerText || "";
            const buttons = Array.from(document.querySelectorAll('button')).map(btn => ({
                text: btn.textContent ? btn.textContent.trim() : "",
                disabled: btn.disabled,
                outerHTML: btn.outerHTML.substring(0, 300)
            }));
            const errors = Array.from(document.querySelectorAll('.error, mat-error, .validation-error')).map(el => el.innerText);
            return { heading, buttons, errors };
        });

        console.log("[promote-closed] Page analysis:", JSON.stringify(analysis, null, 2));

    } catch (e) {
        console.error("[promote-closed] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-closed] CDP client disconnected.");
    }
}

run();
