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

        // Navigate to App Dashboard
        const productionUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-dashboard`;
        console.log(`[promote-bot] Navigating directly to App Dashboard: ${productionUrl}`);
        await page.goto(productionUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        const screenshotPath = resolve(rootDir, "production_track.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[promote-bot] Screenshot saved to ${screenshotPath}`);

        // Analyze elements on the page
        const pageAnalysis = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button, a, [role='button']")).map(el => ({
                tagName: el.tagName,
                text: el.innerText ? el.innerText.trim().replace(/\n/g, " ") : "",
                role: el.getAttribute("role"),
                debugId: el.getAttribute("debug-id"),
                ariaLabel: el.getAttribute("aria-label"),
                className: el.className,
                href: el.getAttribute("href")
            })).filter(b => b.text || b.ariaLabel || b.debugId);

            const headers = Array.from(document.querySelectorAll("h1, h2, h3, h4")).map(h => h.innerText.trim());

            return {
                title: document.title,
                url: window.location.href,
                headers,
                buttons
            };
        });

        console.log("[promote-bot] Page Analysis:", JSON.stringify(pageAnalysis, null, 2));
        writeFileSync(resolve(rootDir, "production_analysis.json"), JSON.stringify(pageAnalysis, null, 2));

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected safely.");
    }
}

run();
