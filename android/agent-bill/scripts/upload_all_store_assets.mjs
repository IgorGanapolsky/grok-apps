import { chromium } from "playwright";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const ASSETS_DIR = resolve(rootDir, "assets/");
const METADATA_DIR = resolve(rootDir, "fastlane/metadata/android/en-US/");

async function uploadAndApplyAsset(page, rowTextPattern, filePaths, isMultiple = false) {
    console.log(`\n==================================================`);
    console.log(`[asset-bot] Starting process for row: "${rowTextPattern}"`);
    console.log(`==================================================`);

    // Ensure the drawer is closed first to avoid overlapping states
    console.log("[asset-bot] Checking if drawer is open...");
    const closeBtn = page.locator('material-drawer button[debug-id="close-button"]').first();
    if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
        console.log("[asset-bot] Closing open drawer first...");
        await closeBtn.click();
        await page.waitForTimeout(2000);
    }

    // Scroll row into view
    console.log(`[asset-bot] Scrolling to row: "${rowTextPattern}"...`);
    await page.evaluate((pattern) => {
        const rows = Array.from(document.querySelectorAll("console-form-row"));
        const targetRow = rows.find(r => r.innerText && new RegExp(pattern, "i").test(r.innerText));
        if (targetRow) {
            targetRow.scrollIntoView({ block: "center" });
        }
    }, rowTextPattern);
    await page.waitForTimeout(2000);

    // Click "Add assets" in the row
    console.log(`[asset-bot] Clicking 'Add assets' on row: "${rowTextPattern}"...`);
    try {
        const rowLocator = page.locator('console-form-row').filter({ hasText: new RegExp(rowTextPattern, 'i') });
        const addBtnLocator = rowLocator.locator('button[debug-id="add-button"], button[debug-id="add-more-button"]').first();
        if (await addBtnLocator.count() > 0) {
            await addBtnLocator.click();
        } else {
            console.log(`[asset-bot] No add-button or add-more-button found, falling back to first button in row`);
            await rowLocator.locator('button').first().click();
        }
    } catch (err) {
        throw new Error(`Failed to click 'Add assets' for row pattern: ${rowTextPattern}. Error: ${err.message}`);
    }

    console.log("[asset-bot] Waiting 4 seconds for drawer to open...");
    await page.waitForTimeout(4000);

    // Check if files need to be uploaded
    console.log("[asset-bot] Checking if target files are already uploaded in the library...");
    const existingAssets = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("asset-list-row")).map(r => r.innerText || "");
    });

    const filesToUpload = [];
    const basenames = filePaths.map(p => p.split("/").pop());

    for (let i = 0; i < filePaths.length; i++) {
        const path = filePaths[i];
        const base = basenames[i];
        // For feature graphic, we want to ensure it has 1024x500px
        const pattern = base === "feature_graphic.png" ? /feature_graphic.png.*1024x500/i : new RegExp(base, "i");
        const found = existingAssets.some(txt => pattern.test(txt));
        if (!found) {
            console.log(`[asset-bot] Asset not found in library: ${base} (needs upload)`);
            filesToUpload.push(path);
        } else {
            console.log(`[asset-bot] Asset already exists in library: ${base}`);
        }
    }

    if (filesToUpload.length > 0) {
        console.log(`[asset-bot] Uploading ${filesToUpload.length} files...`);
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count() === 0) {
            throw new Error("File input not found in drawer.");
        }
        await fileInput.setInputFiles(filesToUpload);
        console.log("[asset-bot] Files set on input. Waiting 15 seconds for upload to complete...");
        await page.waitForTimeout(15000);
    }

    // Deselect any currently selected assets first to ensure clean state
    console.log("[asset-bot] Deselecting any currently selected assets...");
    const rows = page.locator('asset-list-row');
    const count = await rows.count();
    console.log(`[asset-bot] Found ${count} total assets in drawer library.`);
    let deselectedCount = 0;
    for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const text = await row.innerText();
        const isSelected = text.includes("Selected asset") && !text.includes("Deselected asset");
        if (isSelected) {
            console.log(`[asset-bot] Deselecting asset: ${text.split('\n')[0]}`);
            await row.locator('a[debug-id="select-button"]').evaluate(el => el.click());
            await page.waitForTimeout(1500);
            deselectedCount++;
        }
    }
    console.log(`[asset-bot] Successfully deselected ${deselectedCount} assets.`);

    // Select the target assets using Playwright locators for 100% click robustness
    console.log("[asset-bot] Selecting target assets...");
    let selectCount = 0;
    for (const base of basenames) {
        const rowLocator = page.locator('asset-list-row').filter({ has: page.locator(`img[alt="${base}"]`) }).first();
        if (await rowLocator.count() > 0) {
            const text = await rowLocator.innerText();
            const isAlreadySelected = text.includes("Selected asset") && !text.includes("Deselected asset");
            if (!isAlreadySelected) {
                console.log(`[asset-bot] Selecting asset row: ${base}`);
                await rowLocator.locator('a[debug-id="select-button"]').evaluate(el => el.click());
                await page.waitForTimeout(1500);
                selectCount++;
            } else {
                console.log(`[asset-bot] Asset already selected: ${base}`);
                selectCount++;
            }
        } else {
            console.error(`[asset-bot] Target row not found for asset: ${base}`);
        }
    }
    console.log(`[asset-bot] Selected ${selectCount} of ${basenames.length} assets.`);

    // Click "Add" button in the drawer header
    console.log("[asset-bot] Clicking the 'Add' button in the drawer header...");
    const addBtn = page.locator('material-drawer button[debug-id="add-to-content-button"]').first();
    if (await addBtn.count() > 0 && await addBtn.isEnabled()) {
        await addBtn.click();
        console.log("[asset-bot] 'Add' button clicked successfully.");
        await page.waitForTimeout(3000);
    } else {
        console.warn("[asset-bot] Warning: 'Add' button not found or is disabled. Trying fallback click...");
        await page.evaluate(() => {
            const btn = document.querySelector('material-drawer button[debug-id="add-to-content-button"]');
            if (btn) btn.click();
        });
        await page.waitForTimeout(3000);
    }

    // Force close drawer if still open
    if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
        console.log("[asset-bot] Drawer still open, closing it...");
        await closeBtn.click();
        await page.waitForTimeout(1000);
    }

    const screenshotPath = resolve(rootDir, `store_row_${rowTextPattern.replace(/\s+/g, "_")}_completed.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`[asset-bot] Screenshot saved to ${screenshotPath}`);
}

async function run() {
    console.log("[store-listing-bot] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    let page;
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Process App Icon
        const iconPath = resolve(ASSETS_DIR, "icon_512.png");
        await uploadAndApplyAsset(page, "App icon", [iconPath], false);

        // 2. Process Feature Graphic
        const featurePath = resolve(ASSETS_DIR, "feature_graphic.png");
        await uploadAndApplyAsset(page, "Feature graphic", [featurePath], false);

        // 3. Process Phone Screenshots (multiple)
        const screenshotsDir = join(METADATA_DIR, "images/phoneScreenshots/");
        const screenshotNames = ["1-home.png", "2-audit-empty.png", "3-audit-filled.png", "4-settings.png"];
        const screenshotPaths = screenshotNames.map(f => join(screenshotsDir, f));
        await uploadAndApplyAsset(page, "Phone screenshots", screenshotPaths, true);

        // 4. Save the form details
        console.log("\n[store-listing-bot] Saving all updated Store Listing details...");
        const saveListingBtn = page.locator('button:has-text("Save")').first();
        if (await saveListingBtn.count() > 0 && await saveListingBtn.isEnabled()) {
            await saveListingBtn.click();
            console.log("[store-listing-bot] Store listing saved successfully! Waiting 8s for db sync...");
            await page.waitForTimeout(8000);
        } else {
            console.log("[store-listing-bot] Fallback: Clicking Save button using page evaluation...");
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText && b.innerText.includes("Save"));
                if (btn) btn.click();
            });
            await page.waitForTimeout(8000);
        }

        const finalScreenshotPath = resolve(rootDir, "store_listing_completed_final.png");
        await page.screenshot({ path: finalScreenshotPath, fullPage: true });
        console.log(`[store-listing-bot] All steps completed! Final screenshot saved to ${finalScreenshotPath}`);

    } catch (e) {
        console.error("[store-listing-bot] Error:", e.message);
        try {
            await page.screenshot({ path: resolve(rootDir, "store_listing_fatal_error.png") });
        } catch (se) {}
    } finally {
        await browser.close().catch(() => {});
        console.log("[store-listing-bot] CDP client disconnected safely.");
    }
}

run();
