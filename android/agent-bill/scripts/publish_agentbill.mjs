import { chromium } from "playwright";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const CANARY_BIN = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const CANARY_PROFILE = "/Users/igorganapolsky/Library/Application Support/Google/Chrome Canary";

const DEV_ID = "5569424694437250668";
const APP_ID = "4974052329761927376";

const APPS_LIST_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/apps-list`;
const METADATA_DIR = resolve(rootDir, "fastlane/metadata/android/en-US/");
const ASSETS_DIR = resolve(rootDir, "assets/");
const AAB_PATH = resolve(rootDir, "app/build/outputs/bundle/release/app-release.aab");

async function run() {
    console.log("[publish] Starting AgentBill publication...");

    let profileDir = CANARY_PROFILE;
    
    console.log(`[publish] Attempting to use LIVE profile: ${profileDir}`);

    let ctx;
    try {
        ctx = await chromium.launchPersistentContext(profileDir, {
            headless: false,
            executablePath: CANARY_BIN,
            viewport: { width: 1440, height: 900 },
            args: [
                "--disable-blink-features=AutomationControlled"
            ],
            ignoreDefaultArgs: ["--enable-automation", "--no-first-run", "--no-default-browser-check"]
        });
    } catch (err) {
        if (err.message.includes("lock") || err.message.includes("user data directory is already in use")) {
            console.error("[publish] Browser profile is locked. Please close Chrome Canary or start it with:");
            console.error(`[publish] "${CANARY_BIN}" --remote-debugging-port=9222`);
            console.error("[publish] Then use the CDP-based scripts (e.g., publish_agentbill_canary_cdp.mjs).");
            process.exit(1);
        }
        throw err;
    }

    const page = ctx.pages()[0] || (await ctx.newPage());

    try {
        console.log(`[publish] Navigating to apps list: ${APPS_LIST_URL}`);
        await page.goto(APPS_LIST_URL, { waitUntil: "domcontentloaded", timeout: 90000 });

        // Wait a bit for redirects
        await page.waitForTimeout(5000);

        // Handle Auth
        if (page.url().includes("accounts.google.com")) {
            console.log("[publish] Authentication required. PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW.");
            await page.screenshot({ path: join(rootDir, "auth_required.png") });
            
            try {
                await page.waitForURL(/play.google.com\/console/, { timeout: 600000 });
                console.log("[publish] Logged in successfully.");
            } catch (err) {
                if (err.message.includes("closed")) {
                    console.error("[publish] Browser was closed during auth.");
                }
                throw err;
            }
        }

        console.log("[publish] Waiting for apps list to load...");
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(5000);
        await page.screenshot({ path: join(rootDir, "apps_list_state.png") });

        // Search for AgentBill
        console.log("[publish] Searching for 'AgentBill'...");
        const agentBillLink = page.locator(`a[href*="${APP_ID}"]`).first();
        if (await agentBillLink.count() > 0) {
            console.log("[publish] 'AgentBill' found by ID. Clicking...");
            await agentBillLink.click();
        } else {
            const textLink = page.locator('text="AgentBill"').first();
            if (await textLink.count() > 0) {
                console.log("[publish] 'AgentBill' found by text. Clicking...");
                await textLink.click();
            } else {
                throw new Error("AgentBill not found in apps list.");
            }
        }

        await page.waitForTimeout(5000);
        
        // Main Store Listing
        const storeListingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/main-store-listing`;
        console.log(`[publish] Navigating to Store Listing: ${storeListingUrl}`);
        await page.goto(storeListingUrl, { waitUntil: "networkidle" });

        const titleText = "AgentBill — AI Cost Auditor";
        const shortDescText = readFileSync(join(METADATA_DIR, "short_description.txt"), "utf8").trim();
        const fullDescText = readFileSync(join(METADATA_DIR, "full_description.txt"), "utf8").trim();

        await page.fill('input[aria-label="App name"]', titleText);
        await page.fill('textarea[aria-label="Short description"]', shortDescText);
        await page.fill('textarea[aria-label="Full description"]', fullDescText);

        console.log("[publish] Uploading assets...");
        const logoPath = resolve(ASSETS_DIR, "icon_512.png");
        const featureGraphicPath = resolve(ASSETS_DIR, "feature_graphic.png");
        const screenshotsDir = join(METADATA_DIR, "images/phoneScreenshots/");
        const screenshotFiles = readdirSync(screenshotsDir)
            .filter(f => f.endsWith(".png"))
            .map(f => join(screenshotsDir, f))
            .slice(0, 8);

        // Upload Logo
        const logoInput = page.locator('section:has-text("App icon") input[type="file"], section:has-text("App Icon") input[type="file"]').first();
        await logoInput.setInputFiles(logoPath);
        await page.waitForTimeout(3000);

        // Upload Feature Graphic
        const featureInput = page.locator('section:has-text("Feature graphic") input[type="file"], section:has-text("Feature Graphic") input[type="file"]').first();
        await featureInput.setInputFiles(featureGraphicPath);
        await page.waitForTimeout(3000);

        // Upload Screenshots
        const screenshotInput = page.locator('section:has-text("Phone screenshots") input[type="file"], section:has-text("Phone Screenshots") input[type="file"]').first();
        await screenshotInput.setInputFiles(screenshotFiles);
        await page.waitForTimeout(5000);

        console.log("[publish] Saving listing...");
        await page.locator('button:has-text("Save")').first().click();
        await page.waitForTimeout(5000);

        // Internal Testing
        const internalTestingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/internal-testing`;
        console.log(`[publish] Navigating to Internal Testing: ${internalTestingUrl}`);
        await page.goto(internalTestingUrl, { waitUntil: "networkidle" });

        const createReleaseBtn = page.locator('button:has-text("Create new release"), button:has-text("Create New Release")').first();
        if (await createReleaseBtn.count() > 0) {
            await createReleaseBtn.click();
        } else {
            await page.locator('button:has-text("Edit release"), button:has-text("Edit Release")').first().click().catch(() => {});
        }
        await page.waitForTimeout(3000);

        console.log(`[publish] Uploading AAB: ${AAB_PATH}`);
        await page.locator('input[type="file"]').first().setInputFiles(AAB_PATH);

        console.log("[publish] Waiting for AAB upload...");
        await page.waitForSelector('button:has-text("Save"):not([disabled])', { timeout: 300000 });

        await page.click('button:has-text("Save")');
        await page.waitForTimeout(3000);

        await page.locator('button:has-text("Review release"), button:has-text("Review Release")').first().click();
        await page.waitForTimeout(5000);

        await page.screenshot({ path: join(rootDir, "final_publish_state.png"), fullPage: true });
        console.log("[publish] Done!");

    } catch (err) {
        console.error(`[publish] Error: ${err.message}`);
        await page.screenshot({ path: join(rootDir, "publish_error.png") }).catch(() => {});
    } finally {
        console.log("[publish] Keeping browser open for 60s.");
        await page.waitForTimeout(60000).catch(() => {});
        await ctx.close().catch(() => {});
    }
}

run();
