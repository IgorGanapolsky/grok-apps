import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const INTERNAL_TESTING_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/tracks/internal-testing`;

async function run() {
    console.log("[inspect-internal] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) page = await ctx.newPage();

        await page.setViewportSize({ width: 1440, height: 900 });

        console.log(`[inspect-internal] Navigating to: ${INTERNAL_TESTING_URL}`);
        await page.goto(INTERNAL_TESTING_URL, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        const screenshotPath = resolve(rootDir, "internal_testing_track.png");
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[inspect-internal] Screenshot saved to ${screenshotPath}`);

        // Extract all visible buttons, links and text to find the promotion triggers
        const elements = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button, a, [role='button']")).map(el => ({
                text: el.innerText ? el.innerText.trim().replace(/\n/g, " ") : "",
                tagName: el.tagName,
                href: el.getAttribute("href"),
                className: el.className,
                debugId: el.getAttribute("debug-id")
            })).filter(b => b.text);

            const headers = Array.from(document.querySelectorAll("h1, h2, h3, h4")).map(h => h.innerText.trim());
            const textContent = document.body.innerText ? document.body.innerText.substring(0, 3000) : "";

            return { title: document.title, headers, buttons, textContent };
        });

        console.log("[inspect-internal] Page headers:", elements.headers);
        console.log("[inspect-internal] Actionable buttons/links:", JSON.stringify(elements.buttons, null, 2));

    } catch (e) {
        console.error("[inspect-internal] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[inspect-internal] CDP client disconnected.");
    }
}

run();
