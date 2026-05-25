import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const ASSETS_DIR = resolve(rootDir, "assets/");

async function run() {
    console.log("[test-upload] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        console.log(`[test-upload] Active page title: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        const logoPath = resolve(ASSETS_DIR, "icon_512.png");
        console.log(`[test-upload] Using logo path: ${logoPath}`);

        console.log("[test-upload] Locating 'App icon' console-form-row...");
        const iconSection = page.locator('console-form-row').filter({ hasText: /App icon/i });
        const iconBtn = iconSection.locator('button:has-text("Add assets")').first();

        console.log("[test-upload] Clicking 'Add assets' for App Icon and waiting for file chooser...");
        const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
        await iconBtn.click();
        const fileChooser = await fileChooserPromise;

        console.log("[test-upload] File chooser active. Setting file...");
        await fileChooser.setFiles(logoPath);
        console.log("[test-upload] File set! Waiting 5s for upload to complete...");
        await page.waitForTimeout(5000);

        await page.screenshot({ path: resolve(rootDir, "icon_uploaded_test.png") });
        console.log("[test-upload] Screenshot saved to icon_uploaded_test.png");

    } catch (e) {
        console.error("[test-upload] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[test-upload] CDP client disconnected.");
    }
}

run();
