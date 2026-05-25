import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const ASSETS_DIR = resolve(rootDir, "assets/");

async function run() {
    console.log("[drawer-upload] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // Ensure the drawer is closed first to avoid overlapping states
        console.log("[drawer-upload] Checking if drawer is already open...");
        const closeBtn = page.locator('aside button[aria-label*="close" i], aside button[aria-label*="Close" i]').first();
        if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
            console.log("[drawer-upload] Closing open drawer first...");
            await closeBtn.click();
            await page.waitForTimeout(2000);
        }

        // Scroll App Icon into view
        await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
            if (el) el.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(2000);

        console.log("[drawer-upload] Clicking 'Add assets' for App Icon...");
        await page.evaluate(() => {
            const row = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
            const btn = row.querySelector("button");
            if (btn) btn.click();
        });
        await page.waitForTimeout(4000);

        const logoPath = resolve(ASSETS_DIR, "icon_512.png");
        console.log(`[drawer-upload] Resized icon path: ${logoPath}`);

        // Locate upload button in drawer
        const drawerUploadBtn = page.locator('aside button:has-text("Upload"), .drawer button:has-text("Upload"), div[role="dialog"] button:has-text("Upload")').first();
        
        console.log("[drawer-upload] Clicking 'Upload' button in side drawer...");
        const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
        await drawerUploadBtn.click();
        const fileChooser = await fileChooserPromise;

        console.log("[drawer-upload] Setting icon files...");
        await fileChooser.setFiles(logoPath);
        console.log("[drawer-upload] Icon files set. Waiting 10s for upload to complete...");
        await page.waitForTimeout(10000);

        await page.screenshot({ path: resolve(rootDir, "drawer_after_upload.png") });
        console.log("[drawer-upload] Saved drawer_after_upload.png");

    } catch (e) {
        console.error("[drawer-upload] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[drawer-upload] CDP client disconnected.");
    }
}

run();
