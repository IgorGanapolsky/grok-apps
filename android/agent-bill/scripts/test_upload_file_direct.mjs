import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const ASSETS_DIR = resolve(rootDir, "assets/");

async function run() {
    console.log("[upload-direct] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // Force close any existing drawer / modal
        console.log("[upload-direct] Closing open drawer / modal if any...");
        await page.evaluate(() => {
            const closeButtons = Array.from(document.querySelectorAll("aside button, [role='dialog'] button, .drawer button")).filter(b => {
                const txt = b.innerText ? b.innerText.toLowerCase() : "";
                const aria = b.getAttribute("aria-label") ? b.getAttribute("aria-label").toLowerCase() : "";
                return txt.includes("close") || aria.includes("close");
            });
            closeButtons.forEach(b => b.click());
        });
        await page.waitForTimeout(2000);

        // Click "Add assets" in the "App icon" row (row index 3)
        console.log("[upload-direct] Clicking 'Add assets' on 'App icon' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const iconRow = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (iconRow) {
                const btn = iconRow.querySelector("button");
                if (btn) btn.click();
            }
        });
        await page.waitForTimeout(4000);

        // Locate the file input inside the drawer
        console.log("[upload-direct] Locating file input...");
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count() === 0) {
            throw new Error("File input not found in drawer.");
        }

        const iconPath = resolve(ASSETS_DIR, "icon_512.png");
        console.log(`[upload-direct] Setting files directly on input: ${iconPath}`);
        await fileInput.setInputFiles(iconPath);

        console.log("[upload-direct] Files set. Waiting 12 seconds for upload to complete and UI to update...");
        await page.waitForTimeout(12000);

        // Save a screenshot after upload
        const screenshotPath = resolve(rootDir, "drawer_after_upload_direct.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[upload-direct] Screenshot saved to ${screenshotPath}`);

        // Let's dump the buttons and grid items in the drawer now!
        const postUploadInfo = await page.evaluate(() => {
            const drawer = document.querySelector("aside, .drawer, div[role='dialog']");
            if (!drawer) return { found: false };

            const buttons = Array.from(drawer.querySelectorAll("button")).map(b => ({
                text: b.innerText.trim(),
                ariaLabel: b.getAttribute("aria-label"),
                disabled: b.disabled || b.getAttribute("disabled") !== null,
                outerHTML: b.outerHTML.substring(0, 300)
            }));

            const gridItems = Array.from(drawer.querySelectorAll("li, [role='listitem'], .grid-item, .asset-item")).map((li, idx) => ({
                index: idx,
                tagName: li.tagName,
                className: li.className,
                text: li.innerText ? li.innerText.trim().substring(0, 100) : "",
                selected: li.getAttribute("aria-selected") || li.className.includes("selected") || li.outerHTML.includes("selected")
            }));

            return {
                found: true,
                buttons,
                gridItems
            };
        });

        console.log("[upload-direct] Post-Upload Drawer Info:", JSON.stringify(postUploadInfo, null, 2));

    } catch (e) {
        console.error("[upload-direct] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[upload-direct] CDP client disconnected safely.");
    }
}

run();
