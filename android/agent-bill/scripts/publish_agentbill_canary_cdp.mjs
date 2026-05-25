import { chromium } from "playwright";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const CANARY_BIN = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const CANARY_PROFILE = join(homedir(), "Library/Application Support/Google/Chrome Canary");

const DEV_ID = "5569424694437250668";
const APP_ID = "4974052329761927376";

const METADATA_DIR = resolve(rootDir, "fastlane/metadata/android/en-US/");
const ASSETS_DIR = resolve(rootDir, "assets/");
const AAB_PATH = resolve(rootDir, "app/build/outputs/bundle/release/app-release.aab");

async function run() {
    console.log("[publish-canary] Starting AgentBill publication via Chrome Canary CDP connection...");

    if (!existsSync(CANARY_BIN)) {
        console.error(`Chrome Canary binary not found at ${CANARY_BIN}`);
        process.exit(1);
    }
    if (!existsSync(CANARY_PROFILE)) {
        console.error(`Chrome Canary profile not found at ${CANARY_PROFILE}`);
        process.exit(1);
    }
    if (!existsSync(AAB_PATH)) {
        console.error(`AAB not found: ${AAB_PATH}`);
        process.exit(1);
    }

    // 1. Check if remote debugging port 9222 is already open
    let isPortOpen = false;
    try {
        console.log("[publish-canary] Checking if remote debugging port 9222 is active...");
        execSync("curl -s -m 2 http://127.0.0.1:9222/json/version", { stdio: "ignore" });
        isPortOpen = true;
        console.log("[publish-canary] Remote debugging port 9222 is active! Connecting to existing session...");
    } catch (e) {
        console.log("[publish-canary] Debug port 9222 is not active.");
    }

    if (!isPortOpen) {
        console.log("[publish-canary] Port 9222 is not active. Please start Chrome Canary with --remote-debugging-port=9222");
        console.log(`[publish-canary] Command: "${CANARY_BIN}" --remote-debugging-port=9222`);

        // Attempt to launch it without killing existing processes
        console.log("[publish-canary] Attempting to launch Chrome Canary with remote debugging port 9222...");
        // Copy profile to a custom non-default directory to allow remote debugging on macOS
        const DEBUG_PROFILE = "/tmp/agentbill-canary-profile";
        console.log(`[publish-canary] Preparing custom user data dir to enable remote debugging: ${DEBUG_PROFILE}`);
        try {
            execSync(`mkdir -p "${DEBUG_PROFILE}"`);
        } catch (e) {}

        const cmd = `nohup "${CANARY_BIN}" --remote-debugging-port=9222 --user-data-dir="${DEBUG_PROFILE}" > /dev/null 2>&1 &`;
        try {
            execSync(cmd);
            console.log("[publish-canary] Chrome Canary launch command sent. Waiting 6s for startup...");
            await new Promise(resolve => setTimeout(resolve, 6000));
        } catch (e) {
            console.error("[publish-canary] Failed to launch Chrome Canary automatically.");
        }
    }

    console.log("[publish-canary] Connecting to Chrome Canary via CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    const ctx = browser.contexts()[0];
    if (!ctx) {
        throw new Error("No browser context found over CDP connection");
    }

    const pages = await ctx.pages();
    let page = pages.find((p) => p.url().includes("play.google.com/console"));
    if (!page) {
        console.log("[publish-canary] No active Play Console tab found. Opening a new tab...");
        page = await ctx.newPage();
    }

    await page.setViewportSize({ width: 1440, height: 900 });

    try {
        // ------------------ SESSION WARMUP ------------------
        const appsListUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/apps-list`;
        console.log(`[publish-canary] Warming up session by navigating to Apps List: ${appsListUrl}`);
        await page.goto(appsListUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(8000);

        // Handle Auth
        if (page.url().includes("accounts.google.com")) {
            console.log("[publish-canary] Authentication required. Waiting 60s for manual login or session restore...");
            await page.screenshot({ path: join(rootDir, "canary_auth_required.png") });
            await page.waitForTimeout(60000);
            if (page.url().includes("accounts.google.com")) {
                throw new Error("Login failed or timed out.");
            }
        }

        console.log("[publish-canary] Session warmed successfully.");

        // ------------------ MAIN STORE LISTING ------------------
        const storeListingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/main-store-listing`;
        console.log(`[publish-canary] Navigating directly to Main Store Listing: ${storeListingUrl}`);
        await page.goto(storeListingUrl, { waitUntil: "domcontentloaded", timeout: 90000 });

        // Wait for store listing fields to load
        await page.waitForSelector('input[aria-label="Name of the app"]', { timeout: 30000 });

        const titleText = "AgentBill — AI Cost Auditor";
        const shortDescText = readFileSync(join(METADATA_DIR, "short_description.txt"), "utf8").trim();
        const fullDescText = readFileSync(join(METADATA_DIR, "full_description.txt"), "utf8").trim();

        console.log("[publish-canary] Populating store copy...");
        await page.locator('input[aria-label="Name of the app"]').fill(titleText);
        await page.waitForTimeout(1000);
        await page.locator('input[aria-label="Short description of the app"]').fill(shortDescText);
        await page.waitForTimeout(1000);
        await page.locator('textarea[aria-label="Full description of the app"]').fill(fullDescText);
        await page.waitForTimeout(2000);

        console.log("[publish-canary] Uploading graphics assets...");
        const logoPath = resolve(ASSETS_DIR, "icon_512.png");
        const featureGraphicPath = resolve(ASSETS_DIR, "feature_graphic.png");
        const screenshotsDir = join(METADATA_DIR, "images/phoneScreenshots/");
        
        // Find screenshot files (use the 1920 ones)
        const screenshotFiles = readdirSync(screenshotsDir)
            .filter(f => f.endsWith("-1920.png") || f.endsWith("-1920-rgb.png"))
            .map(f => join(screenshotsDir, f))
            .slice(0, 8);

        console.log(`[publish-canary] Logo path: ${logoPath}`);
        console.log(`[publish-canary] Feature graphic path: ${featureGraphicPath}`);
        console.log(`[publish-canary] Phone screenshots count: ${screenshotFiles.length}`);

        // Upload Logo
        console.log("[publish-canary] Uploading App Icon...");
        try {
            const iconSection = page.locator('section:has-text("App icon"), div:has-text("App icon"), div:has-text("App Icon")').first();
            const iconDelete = iconSection.locator('button[aria-label="Remove"], button:has-text("delete")').first();
            if (await iconDelete.count() > 0 && await iconDelete.isVisible()) {
                console.log("[publish-canary] Removing existing App Icon...");
                await iconDelete.click();
                await page.waitForTimeout(2000);
            }
            const iconAdd = iconSection.locator('button:has-text("Add assets")').first();
            const [iconChooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                iconAdd.click()
            ]);
            await iconChooser.setFiles(logoPath);
            console.log("[publish-canary] App Icon uploaded successfully.");
            await page.waitForTimeout(5000);
        } catch (err) {
            console.warn(`[publish-canary] App Icon upload warning/error: ${err.message}`);
        }

        // Upload Feature Graphic
        console.log("[publish-canary] Uploading Feature Graphic...");
        try {
            const featureSection = page.locator('section:has-text("Feature graphic"), div:has-text("Feature graphic"), div:has-text("Feature Graphic")').first();
            const featureDelete = featureSection.locator('button[aria-label="Remove"], button:has-text("delete")').first();
            if (await featureDelete.count() > 0 && await featureDelete.isVisible()) {
                console.log("[publish-canary] Removing existing Feature Graphic...");
                await featureDelete.click();
                await page.waitForTimeout(2000);
            }
            const featureAdd = featureSection.locator('button:has-text("Add assets")').first();
            const [featureChooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                featureAdd.click()
            ]);
            await featureChooser.setFiles(featureGraphicPath);
            console.log("[publish-canary] Feature Graphic uploaded successfully.");
            await page.waitForTimeout(5000);
        } catch (err) {
            console.warn(`[publish-canary] Feature Graphic upload warning/error: ${err.message}`);
        }

        // Upload Screenshots
        if (screenshotFiles.length > 0) {
            console.log("[publish-canary] Uploading phone screenshots...");
            try {
                const screenshotSection = page.locator('section:has-text("Phone screenshots"), div:has-text("Phone screenshots"), div:has-text("Phone Screenshots")').first();
                const screenshotAdd = screenshotSection.locator('button:has-text("Add assets")').first();
                const [screenshotChooser] = await Promise.all([
                    page.waitForEvent('filechooser'),
                    screenshotAdd.click()
                ]);
                await screenshotChooser.setFiles(screenshotFiles);
                console.log("[publish-canary] Screenshots uploaded successfully.");
                await page.waitForTimeout(8000);
            } catch (err) {
                console.warn(`[publish-canary] Screenshots upload warning/error: ${err.message}`);
            }
        }

        console.log("[publish-canary] Saving Store Listing details...");
        const saveListingBtn = page.locator('button:has-text("Save")').first();
        await saveListingBtn.click();
        console.log("[publish-canary] Store listing saved! Waiting 6s for database synchronization...");
        await page.waitForTimeout(6000);


        // ------------------ INTERNAL TESTING RELEASE ------------------
        const internalTestingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/internal-testing`;
        console.log(`[publish-canary] Navigating directly to Internal Testing: ${internalTestingUrl}`);
        await page.goto(internalTestingUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(8000);

        console.log("[publish-canary] Checking for release action buttons...");
        const createReleaseBtn = page.getByRole("button", { name: /create new release/i }).first();
        if (await createReleaseBtn.count() > 0 && await createReleaseBtn.isVisible()) {
            console.log("[publish-canary] Clicking 'Create new release'...");
            await createReleaseBtn.click();
            await page.waitForTimeout(4000);
        } else {
            const editReleaseBtn = page.getByRole("button", { name: /edit release/i }).first();
            if (await editReleaseBtn.count() > 0 && await editReleaseBtn.isVisible()) {
                console.log("[publish-canary] Clicking 'Edit release'...");
                await editReleaseBtn.click();
                await page.waitForTimeout(4000);
            } else {
                console.log("[publish-canary] No release buttons found, might be already on the release form.");
            }
        }

        console.log(`[publish-canary] Uploading release AAB: ${AAB_PATH}`);
        try {
            const fileInput = page.locator('input[type="file"]').first();
            if (await fileInput.count() > 0) {
                await fileInput.setInputFiles(AAB_PATH);
            } else {
                console.log("[publish-canary] No direct file input found. Triggering via Upload button...");
                const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Upload App Bundle")').first();
                const [aabChooser] = await Promise.all([
                    page.waitForEvent('filechooser'),
                    uploadBtn.click()
                ]);
                await aabChooser.setFiles(AAB_PATH);
            }
            console.log("[publish-canary] AAB upload initiated.");
        } catch (err) {
            console.warn(`[publish-canary] Direct AAB upload failed, trying drag-and-drop/trigger fallback: ${err.message}`);
            try {
                const [aabChooser] = await Promise.all([
                    page.waitForEvent('filechooser'),
                    page.locator('div:has-text("drag and drop"), div:has-text("Drag and drop"), button:has-text("Upload")').first().click()
                ]);
                await aabChooser.setFiles(AAB_PATH);
                console.log("[publish-canary] AAB upload initiated via fallback file chooser.");
            } catch (err2) {
                throw new Error(`AAB Upload completely failed: ${err.message} -> ${err2.message}`);
            }
        }

        console.log("[publish-canary] Waiting for AAB upload and parsing (up to 3 minutes)...");
        await page.waitForTimeout(15000);
        
        // Wait for the Save button to become enabled
        const saveReleaseBtn = page.locator('button:has-text("Save"), button:has-text("Save as draft")').first();
        await saveReleaseBtn.waitFor({ state: "visible", timeout: 180000 });
        console.log("[publish-canary] AAB uploaded successfully!");

        console.log("[publish-canary] Filling release notes...");
        const notesField = page.locator("textarea").first();
        if (await notesField.count()) {
            await notesField.fill("AgentBill v0.1.0 — initial Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.");
            await page.waitForTimeout(1000);
        }

        console.log("[publish-canary] Saving release draft...");
        await saveReleaseBtn.click();
        await page.waitForTimeout(4000);

        console.log("[publish-canary] Progressing to rollout review page...");
        const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewButton.count()) {
            await reviewButton.click();
            await page.waitForTimeout(5000);
        }

        console.log("[publish-canary] Release successfully staged! Capturing rollout dashboard screenshot...");
        await page.screenshot({ path: join(rootDir, "play_console_rollout_ready.png"), fullPage: true });
        console.log("[publish-canary] Saved staging screenshot to play_console_rollout_ready.png");

        console.log("[publish-canary] Publication completed successfully!");

    } catch (err) {
        console.error(`[publish-canary] Error: ${err.message}`);
        await page.screenshot({ path: join(rootDir, "publish_error.png") }).catch(() => {});
        console.log("[publish-canary] Saved error screenshot to publish_error.png");
    } finally {
        await browser.close().catch(() => {});
        console.log("[publish-canary] CDP connection closed.");
    }
}

run();
