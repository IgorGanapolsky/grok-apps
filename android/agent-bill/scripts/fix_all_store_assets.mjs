import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[fix-all] Connecting to Comet on remote debugging port 9222...");
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
        console.log("[fix-all] Closing open drawer / modal if any...");
        await page.evaluate(() => {
            const closeButtons = Array.from(document.querySelectorAll("aside button, [role='dialog'] button, .drawer button")).filter(b => {
                const txt = b.innerText ? b.innerText.toLowerCase() : "";
                const aria = b.getAttribute("aria-label") ? b.getAttribute("aria-label").toLowerCase() : "";
                return txt.includes("close") || aria.includes("close");
            });
            closeButtons.forEach(b => b.click());
        });
        await page.waitForTimeout(2000);

        // 1. Clear "App icon" row
        console.log("[fix-all] Scrolling to 'App icon' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (row) row.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(1000);

        console.log("[fix-all] Clearing applied App icons from page...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (row) {
                const deleteBtns = Array.from(row.querySelectorAll('button[debug-id="delete-button"]'));
                console.log(`Found ${deleteBtns.length} delete buttons for App icon`);
                deleteBtns.forEach(btn => btn.click());
            }
        });
        await page.waitForTimeout(2000);

        // 2. Clear "Feature graphic" row
        console.log("[fix-all] Scrolling to 'Feature graphic' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("Feature graphic"));
            if (row) row.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(1000);

        console.log("[fix-all] Clearing applied Feature Graphics from page...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("Feature graphic"));
            if (row) {
                const deleteBtns = Array.from(row.querySelectorAll('button[debug-id="delete-button"]'));
                console.log(`Found ${deleteBtns.length} delete buttons for Feature graphic`);
                deleteBtns.forEach(btn => btn.click());
            }
        });
        await page.waitForTimeout(2000);

        // 3. Clear "Phone screenshots" row
        console.log("[fix-all] Scrolling to 'Phone screenshots' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("Phone screenshots"));
            if (row) row.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(1000);

        console.log("[fix-all] Clearing applied Phone Screenshots from page...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("Phone screenshots"));
            if (row) {
                const deleteBtns = Array.from(row.querySelectorAll('button[debug-id="delete-button"]'));
                console.log(`Found ${deleteBtns.length} delete buttons for Phone screenshots`);
                deleteBtns.forEach(btn => btn.click());
            }
        });
        await page.waitForTimeout(2000);

        // 4. Open App Icon Drawer and Select Correct 512x512 Asset
        console.log("[fix-all] Scrolling to 'App icon' row to add asset...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (row) row.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(1000);

        console.log("[fix-all] Clicking 'Add assets' on 'App icon' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("App icon"));
            if (row) {
                const btn = row.querySelector('button[debug-id="add-button"], button[debug-id="add-more-button"]') || row.querySelector('button');
                if (btn) btn.click();
            }
        });
        console.log("[fix-all] Waiting 5s for App Icon drawer to open...");
        await page.waitForTimeout(5000);

        console.log("[fix-all] Selecting the 512x512px app icon asset...");
        const selectIconSuccess = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            const targetRow = rows.find(r => {
                const text = r.innerText || "";
                return text.includes("icon_512.png") && text.includes("512x512px");
            });
            if (targetRow) {
                const selectBtn = targetRow.querySelector('a[debug-id="select-button"], button[debug-id="select-button"]');
                if (selectBtn) {
                    selectBtn.click();
                    return true;
                }
            }
            return false;
        });
        console.log(`[fix-all] App Icon Selection: ${selectIconSuccess ? "SUCCESS" : "FAILED"}`);
        await page.waitForTimeout(2000);

        console.log("[fix-all] Clicking 'Add' button in drawer header...");
        await page.evaluate(() => {
            const btn = document.querySelector('material-drawer button[debug-id="add-to-content-button"]');
            if (btn) btn.click();
        });
        console.log("[fix-all] Waiting 4s for drawer to apply and close...");
        await page.waitForTimeout(4000);

        // 5. Open Feature Graphic Drawer and Select Correct 1024x500 Asset
        console.log("[fix-all] Scrolling to 'Feature graphic' row to add asset...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("Feature graphic"));
            if (row) row.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(1000);

        console.log("[fix-all] Clicking 'Add assets' on 'Feature graphic' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("Feature graphic"));
            if (row) {
                const btn = row.querySelector('button[debug-id="add-button"], button[debug-id="add-more-button"]') || row.querySelector('button');
                if (btn) btn.click();
            }
        });
        console.log("[fix-all] Waiting 5s for Feature Graphic drawer to open...");
        await page.waitForTimeout(5000);

        console.log("[fix-all] Selecting the 1024x500px feature graphic asset...");
        const selectFeatureSuccess = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            const targetRow = rows.find(r => {
                const text = r.innerText || "";
                return text.includes("feature_graphic.png") && text.includes("1024x500px");
            });
            if (targetRow) {
                const selectBtn = targetRow.querySelector('a[debug-id="select-button"], button[debug-id="select-button"]');
                if (selectBtn) {
                    selectBtn.click();
                    return true;
                }
            }
            return false;
        });
        console.log(`[fix-all] Feature Graphic Selection: ${selectFeatureSuccess ? "SUCCESS" : "FAILED"}`);
        await page.waitForTimeout(2000);

        console.log("[fix-all] Clicking 'Add' button in drawer header...");
        await page.evaluate(() => {
            const btn = document.querySelector('material-drawer button[debug-id="add-to-content-button"]');
            if (btn) btn.click();
        });
        console.log("[fix-all] Waiting 4s for drawer to apply and close...");
        await page.waitForTimeout(4000);

        // 6. Open Phone Screenshots Drawer and Select Correct 1080x2340 Assets
        console.log("[fix-all] Scrolling to 'Phone screenshots' row to add assets...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("Phone screenshots"));
            if (row) row.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(1000);

        console.log("[fix-all] Clicking 'Add assets' on 'Phone screenshots' row...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            const row = rows.find(r => r.innerText && r.innerText.includes("Phone screenshots"));
            if (row) {
                const btn = row.querySelector('button[debug-id="add-button"], button[debug-id="add-more-button"]') || row.querySelector('button');
                if (btn) btn.click();
            }
        });
        console.log("[fix-all] Waiting 5s for Phone Screenshots drawer to open...");
        await page.waitForTimeout(5000);

        console.log("[fix-all] Selecting the four 1080x2340px screenshots...");
        const selectScreenshotsCount = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("asset-list-row"));
            const targetNames = ["1-home.png", "2-audit-empty.png", "3-audit-filled.png", "4-settings.png"];
            let count = 0;
            targetNames.forEach(name => {
                const targetRow = rows.find(r => {
                    const text = r.innerText || "";
                    return text.includes(name) && text.includes("1080x2340px");
                });
                if (targetRow) {
                    const selectBtn = targetRow.querySelector('a[debug-id="select-button"], button[debug-id="select-button"]');
                    if (selectBtn) {
                        selectBtn.click();
                        count++;
                    }
                }
            });
            return count;
        });
        console.log(`[fix-all] Selected ${selectScreenshotsCount} / 4 screenshots.`);
        await page.waitForTimeout(2000);

        console.log("[fix-all] Clicking 'Add' button in drawer header...");
        await page.evaluate(() => {
            const btn = document.querySelector('material-drawer button[debug-id="add-to-content-button"]');
            if (btn) btn.click();
        });
        console.log("[fix-all] Waiting 4s for drawer to apply and close...");
        await page.waitForTimeout(4000);

        // 7. Scroll and click Save
        console.log("[fix-all] Scrolling to 'Save' button...");
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(2000);

        console.log("[fix-all] Clicking Save button...");
        const saveBtnClicked = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText && b.innerText.includes("Save"));
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        console.log(`[fix-all] Click Save Action: ${saveBtnClicked ? "SUCCESS" : "FAILED"}`);
        console.log("[fix-all] Waiting 10s for database save to complete...");
        await page.waitForTimeout(10000);

        // Take a final verification screenshot
        const screenshotPath = resolve(rootDir, "store_listing_completed_final.png");
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[fix-all] Full page verification screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("[fix-all] Error during execution:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[fix-all] CDP client disconnected safely.");
    }
}

run();
