import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[interactive-click] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // Scroll App Icon into view
        await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
            if (el) el.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(2000);

        // We will try three click strategies one by one.
        // Strategy 1: Programmatic button click via page.evaluate
        console.log("[interactive-click] Trying Strategy 1: Programmatic button click in browser...");
        try {
            const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 6000 });
            await page.evaluate(() => {
                const row = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
                const btn = row.querySelector("button");
                if (btn) btn.click();
            });
            const fileChooser = await fileChooserPromise;
            console.log("[interactive-click] Strategy 1 SUCCESSFUL! Triggered file chooser.");
            await browser.close();
            return;
        } catch (e) {
            console.log("[interactive-click] Strategy 1 failed:", e.message);
        }

        // Strategy 2: Programmatic container click via page.evaluate
        console.log("[interactive-click] Trying Strategy 2: Programmatic container click in browser...");
        try {
            const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 6000 });
            await page.evaluate(() => {
                const row = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
                const container = row.querySelector(".container");
                if (container) container.click();
            });
            const fileChooser = await fileChooserPromise;
            console.log("[interactive-click] Strategy 2 SUCCESSFUL! Triggered file chooser.");
            await browser.close();
            return;
        } catch (e) {
            console.log("[interactive-click] Strategy 2 failed:", e.message);
        }

        // Strategy 3: Playwright native click on outer container
        console.log("[interactive-click] Trying Strategy 3: Playwright click on outer container...");
        try {
            const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 6000 });
            const containerLoc = page.locator('console-form-row').filter({ hasText: /App icon/i }).locator('.container').first();
            await containerLoc.click();
            const fileChooser = await fileChooserPromise;
            console.log("[interactive-click] Strategy 3 SUCCESSFUL! Triggered file chooser.");
            await browser.close();
            return;
        } catch (e) {
            console.log("[interactive-click] Strategy 3 failed:", e.message);
        }

        console.log("[interactive-click] All strategies failed to trigger filechooser.");

    } catch (e) {
        console.error("[interactive-click] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[interactive-click] CDP client disconnected.");
    }
}

run();
