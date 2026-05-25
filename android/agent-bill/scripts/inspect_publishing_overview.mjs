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

        const pubOverviewUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/publishing-overview`;
        console.log(`[promote-bot] Navigating directly to Publishing Overview: ${pubOverviewUrl}`);
        await page.goto(pubOverviewUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        const pageText = await page.evaluate(() => document.body.innerText);
        writeFileSync(resolve(rootDir, "publishing_overview_inspect_text.txt"), pageText);

        console.log("\n--- Publishing Overview Page Content ---");
        const lines = pageText.split("\n");
        for (const line of lines) {
            const l = line.trim();
            if (l.length > 0) {
                console.log(`  > ${l}`);
            }
        }
        console.log("----------------------------------------\n");

        // Inspect all buttons
        const buttonInfo = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button, a')).map(el => ({
                text: el.textContent.trim(),
                disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
                tagName: el.tagName
            })).filter(b => b.text.length > 0);
        });
        console.log("Buttons found:", JSON.stringify(buttonInfo, null, 2));

        const screenshotPath = resolve(rootDir, "publishing_overview_inspect.png");
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
