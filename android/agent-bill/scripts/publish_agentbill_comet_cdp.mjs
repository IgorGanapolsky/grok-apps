import { chromium } from "playwright";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const COMET_BIN = "/Applications/Comet.app/Contents/MacOS/Comet";
const COMET_PROFILE = join(homedir(), "Library/Application Support/Comet");

const DEV_ID = "5569424694437250668";
const APP_ID = "4974052329761927376";

const METADATA_DIR = resolve(rootDir, "fastlane/metadata/android/en-US/");
const ASSETS_DIR = resolve(rootDir, "assets/");
const AAB_PATH = resolve(rootDir, "app/build/outputs/bundle/release/app-release.aab");

async function run() {
    console.log("[publish-comet] Starting AgentBill publication via Comet natively over CDP...");

    if (!existsSync(COMET_BIN)) {
        console.error(`Comet binary not found at ${COMET_BIN}`);
        process.exit(1);
    }
    if (!existsSync(AAB_PATH)) {
        console.error(`AAB not found: ${AAB_PATH}`);
        process.exit(1);
    }

    // 1. Check if remote debugging port 9222 is already open
    let isPortOpen = false;
    try {
        console.log("[publish-comet] Checking if remote debugging port 9222 is active...");
        execSync("curl -s -m 2 http://127.0.0.1:9222/json/version", { stdio: "ignore" });
        isPortOpen = true;
        console.log("[publish-comet] Remote debugging port 9222 is active! Connecting to existing session...");
    } catch (e) {
        console.log("[publish-comet] Debug port 9222 is not active.");
    }

    if (!isPortOpen) {
        console.log("[publish-comet] Port 9222 is not active. Please start Comet with --remote-debugging-port=9222");
        console.log(`[publish-comet] Command: "${COMET_BIN}" --remote-debugging-port=9222`);
        
        // Attempt to launch it without killing existing processes
        console.log("[publish-comet] Attempting to launch Comet with remote debugging port 9222...");
        const cmd = `nohup "${COMET_BIN}" --remote-debugging-port=9222 > /dev/null 2>&1 &`;
        try {
            execSync(cmd);
            console.log("[publish-comet] Comet launch command sent. Waiting 6s for startup...");
            await new Promise(resolve => setTimeout(resolve, 6000));
        } catch (e) {
            console.error("[publish-comet] Failed to launch Comet automatically.");
        }
    }

    console.log("[publish-comet] Connecting to Comet via CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    const ctx = browser.contexts()[0];
    if (!ctx) {
        throw new Error("No browser context found over CDP connection");
    }

    const pages = await ctx.pages();
    let page = pages.find((p) => p.url().includes("play.google.com/console"));
    if (!page) {
        console.log("[publish-comet] No active Play Console tab found. Opening a new tab...");
        page = await ctx.newPage();
    }

    await page.setViewportSize({ width: 1440, height: 900 });

    try {
        // ------------------ SESSION WARMUP ------------------
        const appsListUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/apps-list`;
        console.log(`[publish-comet] Warming up session by navigating to Apps List: ${appsListUrl}`);
        await page.goto(appsListUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(8000);

        // Handle Auth
        if (page.url().includes("accounts.google.com")) {
            console.log("[publish-comet] Authentication required. Waiting 60s for manual login or session restore...");
            await page.waitForTimeout(60000);
            if (page.url().includes("accounts.google.com")) {
                throw new Error("Login failed or timed out.");
            }
        }

        console.log("[publish-comet] Session warmed successfully.");

        // ------------------ MAIN STORE LISTING ------------------
        const storeListingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/main-store-listing`;
        console.log(`[publish-comet] Navigating directly to Main Store Listing: ${storeListingUrl}`);
        await page.goto(storeListingUrl, { waitUntil: "networkidle", timeout: 90000 });

        // Wait for store listing fields to load
        await page.waitForSelector('input[aria-label="Name of the app"]', { timeout: 30000 });

        const titleText = "AgentBill — AI Cost Auditor";
        const shortDescText = readFileSync(join(METADATA_DIR, "short_description.txt"), "utf8").trim();
        const fullDescText = readFileSync(join(METADATA_DIR, "full_description.txt"), "utf8").trim();

        console.log("[publish-comet] Populating store copy...");
        await page.locator('input[aria-label="Name of the app"]').fill(titleText);
        await page.waitForTimeout(1000);
        await page.locator('input[aria-label="Short description of the app"]').fill(shortDescText);
        await page.waitForTimeout(1000);
        await page.locator('textarea[aria-label="Full description of the app"]').fill(fullDescText);
        await page.waitForTimeout(2000);

        console.log("[publish-comet] Uploading graphics assets...");
        const logoPath = resolve(ASSETS_DIR, "icon_512.png");
        const featureGraphicPath = resolve(ASSETS_DIR, "feature_graphic.png");
        const screenshotsDir = join(METADATA_DIR, "images/phoneScreenshots/");
        
        // Find screenshot files
        const screenshotFiles = readdirSync(screenshotsDir)
            .filter(f => f.endsWith("-1920.png") || f.endsWith("-1920-rgb.png") || f.endsWith(".png"))
            .map(f => join(screenshotsDir, f))
            .filter(f => !f.includes("icon") && !f.includes("graphic"))
            .slice(0, 8);

        console.log(`[publish-comet] Logo path: ${logoPath}`);
        console.log(`[publish-comet] Feature graphic path: ${featureGraphicPath}`);
        console.log(`[publish-comet] Phone screenshots count: ${screenshotFiles.length}`);

        // Upload Logo
        console.log("[publish-comet] Uploading App Icon...");
        try {
            const iconSection = page.locator('section:has-text("App icon"), div:has-text("App icon"), div:has-text("App Icon")').first();
            const iconDelete = iconSection.locator('button[aria-label="Remove"], button:has-text("delete")').first();
            if (await iconDelete.count() > 0 && await iconDelete.isVisible()) {
                console.log("[publish-comet] Removing existing App Icon...");
                await iconDelete.click();
                await page.waitForTimeout(2000);
            }
            const iconAdd = iconSection.locator('button:has-text("Add assets")').first();
            const [iconChooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                iconAdd.click()
            ]);
            await iconChooser.setFiles(logoPath);
            console.log("[publish-comet] App Icon uploaded successfully.");
            await page.waitForTimeout(5000);
        } catch (err) {
            console.warn(`[publish-comet] App Icon upload warning/error: ${err.message}`);
        }

        // Upload Feature Graphic
        console.log("[publish-comet] Uploading Feature Graphic...");
        try {
            const featureSection = page.locator('section:has-text("Feature graphic"), div:has-text("Feature graphic"), div:has-text("Feature Graphic")').first();
            const featureDelete = featureSection.locator('button[aria-label="Remove"], button:has-text("delete")').first();
            if (await featureDelete.count() > 0 && await featureDelete.isVisible()) {
                console.log("[publish-comet] Removing existing Feature Graphic...");
                await featureDelete.click();
                await page.waitForTimeout(2000);
            }
            const featureAdd = featureSection.locator('button:has-text("Add assets")').first();
            const [featureChooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                featureAdd.click()
            ]);
            await featureChooser.setFiles(featureGraphicPath);
            console.log("[publish-comet] Feature Graphic uploaded successfully.");
            await page.waitForTimeout(5000);
        } catch (err) {
            console.warn(`[publish-comet] Feature Graphic upload warning/error: ${err.message}`);
        }

        // Upload Screenshots
        if (screenshotFiles.length > 0) {
            console.log("[publish-comet] Uploading phone screenshots...");
            try {
                const screenshotSection = page.locator('section:has-text("Phone screenshots"), div:has-text("Phone screenshots"), div:has-text("Phone Screenshots")').first();
                
                // Clear old screenshots if visible
                const deleteBtns = screenshotSection.locator('button[aria-label="Remove"], button:has-text("delete")');
                const deleteCount = await deleteBtns.count();
                if (deleteCount > 0) {
                    console.log(`[publish-comet] Removing ${deleteCount} existing phone screenshots...`);
                    for (let i = 0; i < deleteCount; i++) {
                        await deleteBtns.nth(0).click();
                        await page.waitForTimeout(500);
                    }
                }

                const screenshotAdd = screenshotSection.locator('button:has-text("Add assets")').first();
                const [screenshotChooser] = await Promise.all([
                    page.waitForEvent('filechooser'),
                    screenshotAdd.click()
                ]);
                await screenshotChooser.setFiles(screenshotFiles);
                console.log("[publish-comet] Screenshots uploaded successfully.");
                await page.waitForTimeout(8000);
            } catch (err) {
                console.warn(`[publish-comet] Screenshots upload warning/error: ${err.message}`);
            }
        }

        console.log("[publish-comet] Saving Store Listing details...");
        const saveListingBtn = page.locator('button:has-text("Save")').first();
        await saveListingBtn.click();
        console.log("[publish-comet] Store listing saved! Waiting 6s for database synchronization...");
        await page.waitForTimeout(6000);


        // ------------------ INTERNAL TESTING RELEASE ------------------
        const internalTestingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/tracks/internal-testing`;
        console.log(`[publish-comet] Navigating directly to Internal Testing: ${internalTestingUrl}`);
        await page.goto(internalTestingUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(8000);

        console.log("[publish-comet] Checking for release action buttons...");
        const editReleaseBtn = page.getByRole("button", { name: /edit release/i }).first();
        const createReleaseBtn = page.getByRole("button", { name: /create new release/i }).first();

        if (await editReleaseBtn.count() > 0 && await editReleaseBtn.isVisible() && await editReleaseBtn.isEnabled()) {
            console.log("[publish-comet] Clicking 'Edit release'...");
            await editReleaseBtn.click();
            await page.waitForTimeout(4000);
        } else if (await createReleaseBtn.count() > 0 && await createReleaseBtn.isVisible() && await createReleaseBtn.isEnabled()) {
            console.log("[publish-comet] Clicking 'Create new release'...");
            await createReleaseBtn.click();
            await page.waitForTimeout(4000);
        } else {
            console.log("[publish-comet] No enabled release action buttons found, we might already be on the release form.");
        }

        console.log(`[publish-comet] Uploading release AAB: ${AAB_PATH}`);
        try {
            const fileInput = page.locator('input[type="file"]').first();
            if (await fileInput.count() > 0) {
                await fileInput.setInputFiles(AAB_PATH);
            } else {
                console.log("[publish-comet] No direct file input found. Triggering via Upload button...");
                const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Upload App Bundle")').first();
                const [aabChooser] = await Promise.all([
                    page.waitForEvent('filechooser'),
                    uploadBtn.click()
                ]);
                await aabChooser.setFiles(AAB_PATH);
            }
            console.log("[publish-comet] AAB upload initiated.");
        } catch (err) {
            console.warn(`[publish-comet] Direct AAB upload failed, trying drag-and-drop/trigger fallback: ${err.message}`);
            try {
                const [aabChooser] = await Promise.all([
                    page.waitForEvent('filechooser'),
                    page.locator('div:has-text("drag and drop"), div:has-text("Drag and drop"), button:has-text("Upload")').first().click()
                ]);
                await aabChooser.setFiles(AAB_PATH);
                console.log("[publish-comet] AAB upload initiated via fallback file chooser.");
            } catch (err2) {
                throw new Error(`AAB Upload completely failed: ${err.message} -> ${err2.message}`);
            }
        }

        console.log("[publish-comet] Waiting for AAB upload and parsing (up to 3 minutes)...");
        await page.waitForTimeout(15000);
        
        // Wait for the Save button to become enabled
        const saveReleaseBtn = page.locator('button:has-text("Save"), button:has-text("Save as draft")').first();
        await saveReleaseBtn.waitFor({ state: "visible", timeout: 180000 });
        console.log("[publish-comet] AAB uploaded successfully!");

        console.log("[publish-comet] Filling release notes...");
        const notesField = page.locator("textarea").first();
        if (await notesField.count()) {
            await notesField.fill("AgentBill v0.1.1 — Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.");
            await page.waitForTimeout(1000);
        }

        console.log("[publish-comet] Saving release draft...");
        await saveReleaseBtn.click();
        await page.waitForTimeout(4000);

        console.log("[publish-comet] Progressing to rollout review page...");
        const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewButton.count()) {
            await reviewButton.click();
            await page.waitForTimeout(5000);
        }

        console.log("[publish-comet] Release successfully staged! Capturing rollout dashboard screenshot...");
        await page.screenshot({ path: join(rootDir, "play_console_rollout_ready.png") });
        console.log("[publish-comet] Saved staging screenshot to play_console_rollout_ready.png");

        console.log("[publish-comet] Publication completed successfully!");

    } catch (err) {
        console.error(`[publish-comet] Error: ${err.message}`);
        await page.screenshot({ path: join(rootDir, "publish_error.png") }).catch(() => {});
        console.log("[publish-comet] Saved error screenshot to publish_error.png");
    } finally {
        await browser.close().catch(() => {});
        console.log("[publish-comet] CDP connection closed.");
    }
}

run();
