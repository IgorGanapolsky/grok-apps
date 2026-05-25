import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("[promote-bot] Connecting to Comet...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        
        await page.setViewportSize({ width: 1440, height: 900 });

        const dashboardUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-dashboard`;
        console.log(`[promote-bot] Navigating directly to App Dashboard: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        console.log("[promote-bot] Clicking 'Select an app category and provide contact details'...");
        const targetBtn = page.locator('div.task-available:has-text("Select an app category")').first();
        if (await targetBtn.count() > 0) {
            await targetBtn.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1000);
            await targetBtn.click();
            console.log("[promote-bot] Clicked. Waiting 6 seconds for navigation...");
            await page.waitForTimeout(6000);

            const screenshotPath = resolve(rootDir, "category_contact_page.png");
            await page.screenshot({ path: screenshotPath });
            console.log(`[promote-bot] Screenshot saved to ${screenshotPath}`);

            // Analyze inputs and page state
            const pageAnalysis = await page.evaluate(() => {
                const inputs = Array.from(document.querySelectorAll("input, select, textarea")).map(el => ({
                    tagName: el.tagName,
                    type: el.type,
                    name: el.name,
                    id: el.id,
                    value: el.value,
                    placeholder: el.placeholder,
                    checked: el.checked,
                    labels: el.labels ? Array.from(el.labels).map(l => l.innerText) : []
                }));

                const buttons = Array.from(document.querySelectorAll("button, a, [role='button']")).map(el => ({
                    tagName: el.tagName,
                    text: el.innerText ? el.innerText.trim().replace(/\n/g, " ") : "",
                    debugId: el.getAttribute("debug-id"),
                    ariaLabel: el.getAttribute("aria-label"),
                    disabled: el.disabled || el.getAttribute("aria-disabled") === "true"
                })).filter(b => b.text || b.ariaLabel || b.debugId);

                return {
                    title: document.title,
                    url: window.location.href,
                    inputs,
                    buttons
                };
            });

            console.log("[promote-bot] Page Analysis:", JSON.stringify(pageAnalysis, null, 2));
            writeFileSync(resolve(rootDir, "category_contact_analysis.json"), JSON.stringify(pageAnalysis, null, 2));

        } else {
            console.log("[promote-bot] Task 'Select an app category and provide contact details' not found.");
        }

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected safely.");
    }
}

run();
