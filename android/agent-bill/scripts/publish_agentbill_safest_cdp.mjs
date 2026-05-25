import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const AAB_PATH = resolve(rootDir, "app/build/outputs/bundle/release/app-release.aab");

async function run() {
    console.log("[safest-cdp] Connecting to the running Comet browser over CDP on port 9222...");

    if (!existsSync(AAB_PATH)) {
        console.error(`AAB not found at: ${AAB_PATH}`);
        process.exit(1);
    }

    let browser;
    try {
        browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    } catch (e) {
        console.error("[safest-cdp] Failed to connect to port 9222. Please make sure Comet is running and has --remote-debugging-port=9222 enabled.");
        console.error(e.message);
        process.exit(1);
    }

    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) {
            throw new Error("No browser contexts found.");
        }
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        console.log(`[safest-cdp] Found ${pages.length} active tabs in the current browser.`);
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("[safest-cdp] No active Play Console tab found. Creating a new tab in the existing session...");
            page = await ctx.newPage();
            const devId = "8239620436488925047";
            const appId = "4973243580627455820";
            const internalTestingUrl = `https://play.google.com/console/u/0/developers/${devId}/app/${appId}/tracks/internal-testing`;
            console.log(`[safest-cdp] Navigating new tab to: ${internalTestingUrl}`);
            await page.goto(internalTestingUrl, { waitUntil: "networkidle", timeout: 90000 });
        } else {
            console.log(`[safest-cdp] Attaching directly to existing tab: "${await page.title()}"`);
            console.log(`[safest-cdp] Active URL: ${page.url()}`);
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        // Save current view screenshot before making any changes
        const beforeScreenshot = resolve(rootDir, "current_tab_before.png");
        await page.screenshot({ path: beforeScreenshot });
        console.log(`[safest-cdp] Saved initial state screenshot to: ${beforeScreenshot}`);

        // Check if we are on the release preparation/edit page or if we need to click "Edit release"/"Create release"
        const currentUrl = page.url();
        if (currentUrl.includes("/releases/") && currentUrl.includes("/prepare")) {
            console.log("[safest-cdp] Already on the release preparation page!");
        } else {
            console.log("[safest-cdp] Not on preparation page. Checking for 'Edit release' or 'Create new release' buttons...");
            const editReleaseBtn = page.getByRole("button", { name: /edit release/i }).first();
            const createReleaseBtn = page.getByRole("button", { name: /create new release/i }).first();

            if (await editReleaseBtn.count() > 0 && await editReleaseBtn.isVisible() && await editReleaseBtn.isEnabled()) {
                console.log("[safest-cdp] Clicking 'Edit release'...");
                await editReleaseBtn.click();
                await page.waitForTimeout(6000);
            } else if (await createReleaseBtn.count() > 0 && await createReleaseBtn.isVisible() && await createReleaseBtn.isEnabled()) {
                console.log("[safest-cdp] Clicking 'Create new release'...");
                await createReleaseBtn.click();
                await page.waitForTimeout(6000);
            } else {
                console.log("[safest-cdp] No release action buttons found. Assumed already on the form or direct upload ready.");
            }
        }

        // Now initiate AAB upload
        console.log(`[safest-cdp] Starting upload of release AAB: ${AAB_PATH}`);
        try {
            const fileInput = page.locator('input[type="file"]').first();
            if (await fileInput.count() > 0) {
                console.log("[safest-cdp] Found direct file input. Setting files...");
                await fileInput.setInputFiles(AAB_PATH);
            } else {
                console.log("[safest-cdp] No direct file input found. Triggering via Upload button...");
                const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Upload App Bundle")').first();
                const [aabChooser] = await Promise.all([
                    page.waitForEvent('filechooser'),
                    uploadBtn.click()
                ]);
                await aabChooser.setFiles(AAB_PATH);
            }
            console.log("[safest-cdp] AAB upload initiated successfully. Processing bundle...");
        } catch (err) {
            console.warn(`[safest-cdp] Primary AAB upload failed, trying drag-and-drop / fallback selector: ${err.message}`);
            const [aabChooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                page.locator('div:has-text("drag and drop"), div:has-text("Drag and drop"), button:has-text("Upload")').first().click()
            ]);
            await aabChooser.setFiles(AAB_PATH);
            console.log("[safest-cdp] AAB upload initiated via fallback.");
        }

        // Wait for upload completion (up to 3 minutes)
        console.log("[safest-cdp] Waiting for AAB to upload and be analyzed by Google Play...");
        await page.waitForTimeout(15000);

        const saveReleaseBtn = page.locator('button:has-text("Save"), button:has-text("Save as draft")').first();
        await saveReleaseBtn.waitFor({ state: "visible", timeout: 180000 });
        console.log("[safest-cdp] AAB uploaded successfully!");

        // Populate release notes
        console.log("[safest-cdp] Populating release notes...");
        const notesField = page.locator("textarea").first();
        if (await notesField.count()) {
            await notesField.fill("AgentBill v0.1.2 — Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.");
            await page.waitForTimeout(1000);
        }

        // Save release draft
        console.log("[safest-cdp] Saving release draft...");
        await saveReleaseBtn.click();
        await page.waitForTimeout(5000);

        // Progress to rollout review page
        console.log("[safest-cdp] Progressing to review page...");
        const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewButton.count()) {
            await reviewButton.click();
            await page.waitForTimeout(6000);
        }

        console.log("[safest-cdp] Staged successfully! Capturing confirmation screenshot...");
        const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
        await page.screenshot({ path: finalScreenshot });
        console.log(`[safest-cdp] Saved rollout confirmation to: ${finalScreenshot}`);
        console.log("[safest-cdp] Publication flow complete!");

    } catch (err) {
        console.error(`[safest-cdp] Error occurred: ${err.message}`);
        const errScreenshot = resolve(rootDir, "publish_error.png");
        await page.screenshot({ path: errScreenshot }).catch(() => {});
        console.log(`[safest-cdp] Saved error state screenshot to: ${errScreenshot}`);
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
            console.log("[safest-cdp] CDP connection closed.");
        }
    }
}

run();
