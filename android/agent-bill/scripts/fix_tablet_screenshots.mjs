import { chromium } from "playwright";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const STORE_LISTING_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/main-store-listing`;

const METADATA_DIR = resolve(rootDir, "fastlane/metadata/android/en-US/");

async function run() {
    console.log("[tablet-bot] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        console.log(`[tablet-bot] Navigating directly to Main Store Listing: ${STORE_LISTING_URL}`);
        await page.goto(STORE_LISTING_URL, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        // Ensure the drawer is closed first to avoid overlapping states
        console.log("[tablet-bot] Closing open drawer / modal if any...");
        await page.evaluate(() => {
            const closeButtons = Array.from(document.querySelectorAll("aside button, [role='dialog'] button, .drawer button")).filter(b => {
                const txt = b.innerText ? b.innerText.toLowerCase() : "";
                const aria = b.getAttribute("aria-label") ? b.getAttribute("aria-label").toLowerCase() : "";
                return txt.includes("close") || aria.includes("close");
            });
            closeButtons.forEach(b => b.click());
        });
        await page.waitForTimeout(2000);

        // Define local files to upload
        const screenshotsDir = join(METADATA_DIR, "images/phoneScreenshots/");
        const fileNames = ["1-home-1920.png", "2-audit-empty-1920.png", "3-audit-filled-1920.png", "4-settings-1920.png"];
        const screenshotFiles = fileNames.map(f => join(screenshotsDir, f));

        console.log(`[tablet-bot] Local tablet screenshots: ${screenshotFiles.join(", ")}`);

        // ==================== 7-INCH TABLET SCREENSHOTS ====================
        console.log("[tablet-bot] Scrolling to '7-inch tablet screenshots' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("7-inch tablet screenshots"));
            if (row) row.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(1500);

        console.log("[tablet-bot] Clicking 'Add assets' on '7-inch tablet screenshots' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("7-inch tablet screenshots"));
            if (row) {
                const btn = row.querySelector('button[debug-id="add-button"], button[debug-id="add-more-button"]') || row.querySelector('button');
                if (btn) btn.click();
            }
        });
        console.log("[tablet-bot] Waiting 5s for drawer to open...");
        await page.waitForTimeout(5000);

        // Upload the screenshots inside the drawer
        console.log("[tablet-bot] Finding 'Upload' button inside the drawer...");
        const uploadBtn = page.locator('aside button:has-text("Upload"), .drawer button:has-text("Upload"), div[role="dialog"] button:has-text("Upload")').first();
        if (await uploadBtn.count() > 0) {
            console.log("[tablet-bot] Triggering file chooser upload...");
            const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
            await uploadBtn.click();
            const fileChooser = await fileChooserPromise;
            await fileChooser.setFiles(screenshotFiles);
            console.log("[tablet-bot] Files set. Waiting 12s for uploads to process...");
            await page.waitForTimeout(12000);
        } else {
            console.log("[tablet-bot] Warning: 'Upload' button not found in drawer.");
        }

        // Select the uploaded screenshots
        console.log("[tablet-bot] Selecting the uploaded 1920x1080px screenshots for 7-inch tablet...");
        const select7Count = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            const targetNames = ["1-home-1920", "2-audit-empty-1920", "3-audit-filled-1920", "4-settings-1920"];
            let count = 0;
            targetNames.forEach(name => {
                const targetRow = rows.find(r => {
                    const text = r.innerText || "";
                    return text.includes(name);
                });
                if (targetRow) {
                    const selectBtn = targetRow.querySelector('a[debug-id="select-button"], button[debug-id="select-button"]');
                    if (selectBtn) {
                        // Toggle select if not already selected
                        const isChecked = targetRow.querySelector('material-checkbox[aria-checked="true"], .checked, [class*="selected"]');
                        if (!isChecked) {
                            selectBtn.click();
                        }
                        count++;
                    }
                }
            });
            return count;
        });
        console.log(`[tablet-bot] Selected ${select7Count} / 4 screenshots for 7-inch tablet.`);
        await page.waitForTimeout(2000);

        console.log("[tablet-bot] Clicking 'Add' button in drawer header...");
        await page.evaluate(() => {
            const btn = document.querySelector('material-drawer button[debug-id="add-to-content-button"]');
            if (btn) btn.click();
        });
        console.log("[tablet-bot] Waiting 4s for drawer to close...");
        await page.waitForTimeout(4000);


        // ==================== 10-INCH TABLET SCREENSHOTS ====================
        console.log("[tablet-bot] Scrolling to '10-inch tablet screenshots' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("10-inch tablet screenshots"));
            if (row) row.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(1500);

        console.log("[tablet-bot] Clicking 'Add assets' on '10-inch tablet screenshots' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("10-inch tablet screenshots"));
            if (row) {
                const btn = row.querySelector('button[debug-id="add-button"], button[debug-id="add-more-button"]') || row.querySelector('button');
                if (btn) btn.click();
            }
        });
        console.log("[tablet-bot] Waiting 5s for drawer to open...");
        await page.waitForTimeout(5000);

        // Select the same uploaded screenshots
        console.log("[tablet-bot] Selecting the uploaded 1920x1080px screenshots for 10-inch tablet...");
        const select10Count = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            const targetNames = ["1-home-1920", "2-audit-empty-1920", "3-audit-filled-1920", "4-settings-1920"];
            let count = 0;
            targetNames.forEach(name => {
                const targetRow = rows.find(r => {
                    const text = r.innerText || "";
                    return text.includes(name);
                });
                if (targetRow) {
                    const selectBtn = targetRow.querySelector('a[debug-id="select-button"], button[debug-id="select-button"]');
                    if (selectBtn) {
                        const isChecked = targetRow.querySelector('material-checkbox[aria-checked="true"], .checked, [class*="selected"]');
                        if (!isChecked) {
                            selectBtn.click();
                        }
                        count++;
                    }
                }
            });
            return count;
        });
        console.log(`[tablet-bot] Selected ${select10Count} / 4 screenshots for 10-inch tablet.`);
        await page.waitForTimeout(2000);

        console.log("[tablet-bot] Clicking 'Add' button in drawer header...");
        await page.evaluate(() => {
            const btn = document.querySelector('material-drawer button[debug-id="add-to-content-button"]');
            if (btn) btn.click();
        });
        console.log("[tablet-bot] Waiting 4s for drawer to close...");
        await page.waitForTimeout(4000);


        // ==================== SAVE STORE LISTING ====================
        console.log("[tablet-bot] Scrolling to the bottom to click Save...");
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(2000);

        console.log("[tablet-bot] Clicking Save button...");
        const saveBtnClicked = await page.evaluate(() => {
            // Find the Save button at the bottom of the page (not the "Save as draft" button)
            const buttons = Array.from(document.querySelectorAll("button"));
            const saveBtn = buttons.find(b => b.innerText && b.innerText.trim() === "Save");
            if (saveBtn) {
                saveBtn.click();
                return true;
            }
            return false;
        });
        console.log(`[tablet-bot] Click Save Action: ${saveBtnClicked ? "SUCCESS" : "FAILED"}`);
        console.log("[tablet-bot] Waiting 10s for database save to complete...");
        await page.waitForTimeout(10000);

        // Take a final verification screenshot
        const screenshotPath = resolve(rootDir, "store_listing_tablet_completed.png");
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[tablet-bot] Tablet store listing completed screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("[tablet-bot] Error during execution:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[tablet-bot] CDP client disconnected safely.");
    }
}

run();
