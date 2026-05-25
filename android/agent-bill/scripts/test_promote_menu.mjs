import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const INTERNAL_TESTING_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/tracks/internal-testing`;

async function run() {
    console.log("[promote-test] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) page = await ctx.newPage();

        await page.setViewportSize({ width: 1440, height: 900 });

        console.log(`[promote-test] Navigating to: ${INTERNAL_TESTING_URL}`);
        await page.goto(INTERNAL_TESTING_URL, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        console.log("[promote-test] Finding 'Promote release' button...");
        const promoteBtn = page.locator('button:has-text("Promote release")').first();
        if (await promoteBtn.count() === 0) {
            throw new Error("Promote release button not found.");
        }

        console.log("[promote-test] Scrolling to 'Promote release' button...");
        await promoteBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);

        console.log("[promote-test] Clicking 'Promote release' button...");
        await promoteBtn.click();
        console.log("[promote-test] Waiting 3s for menu to appear...");
        await page.waitForTimeout(3000);

        const screenshotPath = resolve(rootDir, "promote_menu_open.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[promote-test] Screenshot saved to ${screenshotPath}`);

        // Extract menu options
        const menuOptions = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll(".popup-content, .popup, [role='menu'], [role='menuitem'], .mdc-list-item, .menu-item, button, a"));
            return items.map(el => ({
                text: el.innerText ? el.innerText.trim().replace(/\n/g, " ") : "",
                tagName: el.tagName,
                role: el.getAttribute("role"),
                className: el.className
            })).filter(item => item.text && (item.className.includes("menu") || item.className.includes("list") || item.role === "menuitem" || item.text.includes("Production")));
        });

        console.log("[promote-test] Detected menu options:", JSON.stringify(menuOptions, null, 2));

    } catch (e) {
        console.error("[promote-test] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-test] CDP client disconnected.");
    }
}

run();
