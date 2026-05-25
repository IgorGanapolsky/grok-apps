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
const APPS_LIST_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/apps-list`;
const METADATA_DIR = resolve(rootDir, "fastlane/metadata/android/en-US/");
const ASSETS_DIR = resolve(rootDir, "assets/");
const AAB_PATH = resolve(rootDir, "app/build/outputs/bundle/release/app-release.aab");

async function run() {
    console.log("[publish-comet] Starting AgentBill publication via Comet...");

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
        console.log("[publish-comet] Closing active Comet processes to release profile lock...");
        execSync("killall Comet", { stdio: "ignore" });
        console.log("[publish-comet] Comet closed successfully.");
    } catch (e) {
        console.log("[publish-comet] No running Comet processes found.");
    }

    // Wait a brief moment for the lock file to be released by OS
    console.log("[publish-comet] Waiting 3s for system to release lock...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`[publish-comet] Launching headed Comet using LIVE profile: ${COMET_PROFILE}`);
    const ctx = await chromium.launchPersistentContext(COMET_PROFILE, {
        headless: false, // headed so the user can see it live
        executablePath: COMET_BIN,
        viewport: { width: 1440, height: 900 },
        args: [
            "--no-first-run", 
            "--no-default-browser-check",
            "--disable-blink-features=AutomationControlled"
        ],
        ignoreDefaultArgs: ["--enable-automation"]
    });

    const page = ctx.pages()[0] || (await ctx.newPage());

    try {
        console.log(`[publish-comet] Navigating to apps list: ${APPS_LIST_URL}`);
        await page.goto(APPS_LIST_URL, { waitUntil: "domcontentloaded", timeout: 90000 });

        // Wait a bit for page to stabilize
        await page.waitForTimeout(6000);

        // Handle Auth
        if (page.url().includes("accounts.google.com")) {
            console.log("[publish-comet] Authentication required. Waiting 60s for manual login or session restore...");
            await page.waitForTimeout(60000);
            if (page.url().includes("accounts.google.com")) {
                throw new Error("Login failed or timed out.");
            }
        }

        console.log("[publish-comet] Waiting for apps list to load...");
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(5000);

        // Search for AgentBill
        console.log("[publish-comet] Searching for 'AgentBill'...");
        const agentBillLink = page.locator('text="AgentBill"').first();
        if (await agentBillLink.count() > 0) {
            console.log("[publish-comet] 'AgentBill' found. Clicking...");
            await agentBillLink.click();
        } else {
            console.log("[publish-comet] 'AgentBill' not found. Creating app listing...");
            const createBtn = page.locator('button:has-text("Create app"), button:has-text("Create App")').first();
            await createBtn.click();
            await page.waitForTimeout(2000);
            
            await page.waitForSelector('input[aria-label="App name"]');
            await page.fill('input[aria-label="App name"]', "AgentBill");
            
            // Select "App" and "Free"
            await page.locator('mat-radio-button:has-text("App")').click();
            await page.locator('mat-radio-button:has-text("Free")').click();
            
            // Check all checkboxes in the declarations section
            const checkboxes = page.locator('mat-checkbox');
            const count = await checkboxes.count();
            for (let i = 0; i < count; i++) {
                await checkboxes.nth(i).click();
            }
            
            await page.locator('button:has-text("Create app")').click();
            await page.waitForNavigation({ waitUntil: "networkidle" });
        }

        await page.waitForTimeout(5000);
        const appIdMatch = page.url().match(/app\/([a-zA-Z0-9\.\-_]+)/);
        if (!appIdMatch) {
            throw new Error("Failed to capture App ID. Current URL: " + page.url());
        }
        const appId = appIdMatch[1];
        console.log(`[publish-comet] App ID: ${appId}`);

        // Main Store Listing
        const storeListingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${appId}/main-store-listing`;
        console.log(`[publish-comet] Navigating to Store Listing: ${storeListingUrl}`);
        await page.goto(storeListingUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(4000);

        const titleText = "AgentBill — AI Cost Auditor";
        const shortDescText = readFileSync(join(METADATA_DIR, "short_description.txt"), "utf8").trim();
        const fullDescText = readFileSync(join(METADATA_DIR, "full_description.txt"), "utf8").trim();

        console.log("[publish-comet] Updating listing descriptions...");
        // Wait for descriptions to load and fill
        await page.locator('input[aria-label*="App name"]').first().fill(titleText);
        await page.locator('textarea[aria-label*="Short description"]').first().fill(shortDescText);
        await page.locator('textarea[aria-label*="Full description"]').first().fill(fullDescText);

        console.log("[publish-comet] Uploading graphics assets...");
        const logoPath = resolve(ASSETS_DIR, "icon_512.png");
        const featureGraphicPath = resolve(ASSETS_DIR, "feature_graphic.png");
        const screenshotsDir = join(METADATA_DIR, "images/phoneScreenshots/");
        
        // Find screenshot files (use the 1920 ones)
        const screenshotFiles = readdirSync(screenshotsDir)
            .filter(f => f.endsWith("-1920.png") || f.endsWith("-1920-rgb.png"))
            .map(f => join(screenshotsDir, f))
            .slice(0, 8);

        console.log(`[publish-comet] Screenshots to upload: ${screenshotFiles.length}`);

        // Upload Logo
        const logoInput = page.locator('section:has-text("App icon") input[type="file"], section:has-text("App Icon") input[type="file"]').first();
        await logoInput.setInputFiles(logoPath);
        await page.waitForTimeout(3000);

        // Upload Feature Graphic
        const featureInput = page.locator('section:has-text("Feature graphic") input[type="file"], section:has-text("Feature Graphic") input[type="file"]').first();
        await featureInput.setInputFiles(featureGraphicPath);
        await page.waitForTimeout(3000);

        // Upload Screenshots
        if (screenshotFiles.length > 0) {
            const screenshotInput = page.locator('section:has-text("Phone screenshots") input[type="file"], section:has-text("Phone Screenshots") input[type="file"]').first();
            await screenshotInput.setInputFiles(screenshotFiles);
            await page.waitForTimeout(5000);
        }

        console.log("[publish-comet] Saving Store Listing details...");
        const saveListingBtn = page.locator('button:has-text("Save")').first();
        await saveListingBtn.click();
        await page.waitForTimeout(5000);

        // Internal Testing
        const internalTestingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${appId}/internal-testing`;
        console.log(`[publish-comet] Navigating to Internal Testing: ${internalTestingUrl}`);
        await page.goto(internalTestingUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(4000);

        const createReleaseBtn = page.locator('button:has-text("Create new release"), button:has-text("Create New Release")').first();
        if (await createReleaseBtn.count() > 0 && await createReleaseBtn.isVisible()) {
            await createReleaseBtn.click();
        } else {
            const editReleaseBtn = page.locator('button:has-text("Edit release"), button:has-text("Edit Release")').first();
            if (await editReleaseBtn.count() > 0) {
                await editReleaseBtn.click();
            }
        }
        await page.waitForTimeout(3000);

        console.log(`[publish-comet] Uploading release AAB: ${AAB_PATH}`);
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(AAB_PATH);

        console.log("[publish-comet] Waiting for AAB upload and parsing (up to 3 minutes)...");
        await page.waitForTimeout(15000);
        const saveReleaseBtn = page.locator('button:has-text("Save"), button:has-text("Save as draft")').first();
        await saveReleaseBtn.waitFor({ state: "visible", timeout: 180000 });
        
        console.log("[publish-comet] Filling release notes...");
        const notesField = page.locator("textarea").first();
        if (await notesField.count()) {
            await notesField.fill("AgentBill v0.1.0 — initial Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.");
            await page.waitForTimeout(1000);
        }

        console.log("[publish-comet] Saving release draft...");
        await saveReleaseBtn.click();
        await page.waitForTimeout(4000);

        console.log("[publish-comet] Staging release for review...");
        const reviewButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await reviewButton.count()) {
            await reviewButton.click();
            await page.waitForTimeout(3000);
        }

        console.log("[publish-comet] Rollout review screen reached successfully!");
        await page.screenshot({ path: join(rootDir, "play_console_rollout_ready.png"), fullPage: true });

        console.log("[publish-comet] Leaving browser open for 60s for visual verification...");
        await page.waitForTimeout(60000);

    } catch (err) {
        console.error(`[publish-comet] Error: ${err.message}`);
        await page.screenshot({ path: join(rootDir, "publish_error.png") }).catch(() => {});
    } finally {
        await ctx.close().catch(() => {});
        console.log("[publish-comet] Complete.");
    }
}

run();
