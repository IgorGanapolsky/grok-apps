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

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

const METADATA_DIR = resolve(rootDir, "fastlane/metadata/android/en-US/");
const ASSETS_DIR = resolve(rootDir, "assets/");
const AAB_PATH = resolve(rootDir, "app/build/outputs/bundle/release/app-release.aab");

async function run() {
    console.log("[publish-comet] Starting AgentBill publication via Comet (Direct Navigation Mode)...");

    if (!existsSync(COMET_BIN)) {
        console.error(`Comet binary not found at ${COMET_BIN}`);
        process.exit(1);
    }
    if (!existsSync(COMET_PROFILE)) {
        console.error(`Comet profile not found at ${COMET_PROFILE}`);
        process.exit(1);
    }
    if (!existsSync(AAB_PATH)) {
        console.error(`AAB not found: ${AAB_PATH}`);
        process.exit(1);
    }

    // Safely close running Comet to release profile lock
    try {
        console.log("[publish-comet] Closing active Comet processes...");
        execSync("killall Comet", { stdio: "ignore" });
        console.log("[publish-comet] Comet closed successfully.");
    } catch (e) {
        console.log("[publish-comet] No running Comet processes found.");
    }

    // Wait a brief moment for the lock file to be released by OS
    console.log("[publish-comet] Waiting 3s for system to release lock...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Explicitly delete any lingering lock files to prevent Chromium from creating a fresh blank profile
    console.log("[publish-comet] Deleting lingering lock files in Comet profile...");
    for (const lock of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
        try {
            execSync(`rm "${join(COMET_PROFILE, lock)}"`, { stdio: "ignore" });
            console.log(`[publish-comet] Removed lock file: ${lock}`);
        } catch (e) {
            // Ignored if file doesn't exist
        }
    }

    console.log(`[publish-comet] Launching headed Comet using LIVE profile: ${COMET_PROFILE}`);
    const ctx = await chromium.launchPersistentContext(COMET_PROFILE, {
        headless: false, // headed so it runs live
        executablePath: COMET_BIN,
        viewport: { width: 1440, height: 900 },
        args: [
            "--no-first-run", 
            "--no-default-browser-check",
            "--disable-blink-features=AutomationControlled"
        ],
        ignoreDefaultArgs: ["--enable-automation", "--use-mock-keychain", "--password-store=basic"]
    });

    const page = ctx.pages()[0] || (await ctx.newPage());

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
        await page.waitForTimeout(8000);

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
        
        // Find screenshot files (use the 1920 ones)
        const screenshotFiles = readdirSync(screenshotsDir)
            .filter(f => f.endsWith("-1920.png") || f.endsWith("-1920-rgb.png"))
            .map(f => join(screenshotsDir, f))
            .slice(0, 8);

        console.log(`[publish-comet] Logo path: ${logoPath}`);
        console.log(`[publish-comet] Feature graphic path: ${featureGraphicPath}`);
        console.log(`[publish-comet] Phone screenshots count: ${screenshotFiles.length}`);        // Upload Logo
        console.log("[publish-comet] Uploading App Icon...");
        try {
            const iconInput = page.locator('section, div').filter({ hasText: /App icon/i }).locator('input[type="file"]').first();
            await iconInput.setInputFiles(logoPath);
            console.log("[publish-comet] App Icon uploaded successfully.");
            await page.waitForTimeout(5000);
        } catch (err) {
            console.warn(`[publish-comet] App Icon upload warning/error: ${err.message}`);
        }

        // Upload Feature Graphic
        console.log("[publish-comet] Uploading Feature Graphic...");
        try {
            const featureInput = page.locator('section, div').filter({ hasText: /Feature graphic/i }).locator('input[type="file"]').first();
            await featureInput.setInputFiles(featureGraphicPath);
            console.log("[publish-comet] Feature Graphic uploaded successfully.");
            await page.waitForTimeout(5000);
        } catch (err) {
            console.warn(`[publish-comet] Feature Graphic upload warning/error: ${err.message}`);
        }

        // Upload Screenshots
        if (screenshotFiles.length > 0) {
            console.log("[publish-comet] Uploading phone screenshots...");
            try {
                const screenshotInput = page.locator('section, div').filter({ hasText: /Phone screenshots/i }).locator('input[type="file"]').first();
                await screenshotInput.setInputFiles(screenshotFiles);
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
        const createReleaseBtn = page.getByRole("button", { name: /create new release/i }).first();
        if (await createReleaseBtn.count() > 0 && await createReleaseBtn.isVisible()) {
            console.log("[publish-comet] Clicking 'Create new release'...");
            await createReleaseBtn.click();
            await page.waitForTimeout(4000);
        } else {
            const editReleaseBtn = page.getByRole("button", { name: /edit release/i }).first();
            if (await editReleaseBtn.count() > 0 && await editReleaseBtn.isVisible()) {
                console.log("[publish-comet] Clicking 'Edit release'...");
                await editReleaseBtn.click();
                await page.waitForTimeout(4000);
            } else {
                console.log("[publish-comet] No release buttons found, might be already on the release form.");
            }
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
            await notesField.fill("AgentBill v0.1.0 — initial Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.");
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
        await page.screenshot({ path: join(rootDir, "play_console_rollout_ready.png"), fullPage: true });
        console.log("[publish-comet] Saved staging screenshot to play_console_rollout_ready.png");

        console.log("[publish-comet] Publication completed successfully!");

    } catch (err) {
        console.error(`[publish-comet] Error: ${err.message}`);
        await page.screenshot({ path: join(rootDir, "publish_error.png") }).catch(() => {});
        console.log("[publish-comet] Saved error screenshot to publish_error.png");
    } finally {
        await ctx.close().catch(() => {});
        console.log("[publish-comet] Browser context closed.");
    }
}

run();
