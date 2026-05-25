import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const ASSETS_DIR = resolve(rootDir, "assets/");

async function run() {
    console.log("[global-upload] Connecting to Comet on remote debugging port 9222...");
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

        const logoPath = resolve( ASSETS_DIR, "icon_512.png" );
        console.log(`[global-upload] Using logo path: ${logoPath}`);

        // Get the global input
        const globalInput = page.locator('input[type="file"]').first();
        
        console.log("[global-upload] Strategy A: Uploading directly to global input without clicking button...");
        try {
            await globalInput.setInputFiles(logoPath);
            console.log("[global-upload] Files set on global input. Waiting 6s...");
            await page.waitForTimeout(6000);
            await page.screenshot({ path: resolve(rootDir, "global_upload_direct.png") });
            console.log("[global-upload] Saved global_upload_direct.png");
        } catch (err) {
            console.log("[global-upload] Strategy A failed:", err.message);
        }

    } catch (e) {
        console.error("[global-upload] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[global-upload] CDP client disconnected.");
    }
}

run();
