import { chromium } from "playwright";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const STORE_LISTING_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/main-store-listing`;

const METADATA_DIR = resolve(rootDir, "fastlane/metadata/android/en-US/");
const ASSETS_DIR = resolve(rootDir, "assets/");

async function run() {
    console.log("[store-listing-bot] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        console.log(`[store-listing-bot] Found ${pages.length} active tabs.`);
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("[store-listing-bot] No Play Console tab found. Opening a new tab...");
            page = await ctx.newPage();
        } else {
            console.log(`[store-listing-bot] Attaching directly to existing tab: "${await page.title()}"`);
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        console.log(`[store-listing-bot] Navigating directly to Main Store Listing: ${STORE_LISTING_URL}`);
        await page.goto(STORE_LISTING_URL, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        // Wait for store listing fields to load
        console.log("[store-listing-bot] Waiting for 'Name of the app' input to be visible...");
        await page.waitForSelector('input[aria-label="Name of the app"]', { timeout: 30000 });

        const titleText = "AgentBill — AI Cost Auditor";
        const shortDescText = "Audit your AI coding bills, session logs, and CI transcripts on the go.";
        const fullDescText = "AgentBill is the ultimate AI cost auditor for developers and solo founders. Seamlessly audit and scan your AI coding bills, agent transcripts, and session logs for repeated mistakes that quietly cost you money. Detect hallucinated imports, retry loops, redundant tool calls, and force-pushes instantly. Take control of your AI API spends and optimize your workflows with actionable recommendations directly from your device.";

        console.log("[store-listing-bot] Populating store copy...");
        
        // Fill App Name
        await page.locator('input[aria-label="Name of the app"]').fill(titleText);
        await page.waitForTimeout(1000);
        
        // Fill Short Description
        await page.locator('input[aria-label="Short description of the app"]').fill(shortDescText);
        await page.waitForTimeout(1000);
        
        // Fill Full Description
        await page.locator('textarea[aria-label="Full description of the app"]').fill(fullDescText);
        await page.waitForTimeout(2000);

        console.log("[store-listing-bot] Uploading graphics assets...");
        const logoPath = resolve(ASSETS_DIR, "icon_512.png");
        const featureGraphicPath = resolve(ASSETS_DIR, "feature_graphic.png");
        
        const screenshotsDir = join(METADATA_DIR, "images/phoneScreenshots/");
        const fileNames = ["1-home.png", "2-audit-empty.png", "3-audit-filled.png", "4-settings.png"];
        const screenshotFiles = fileNames.map(f => join(screenshotsDir, f));

        console.log(`[store-listing-bot] Logo path: ${logoPath}`);
        console.log(`[store-listing-bot] Feature graphic path: ${featureGraphicPath}`);
        console.log(`[store-listing-bot] Screenshots: ${screenshotFiles.join(", ")}`);

        // Upload Logo
        console.log("[store-listing-bot] Uploading App Icon...");
        try {
            const iconInput = page.locator('section, div').filter({ hasText: /App icon/i }).locator('input[type="file"]').first();
            await iconInput.setInputFiles(logoPath);
            console.log("[store-listing-bot] App Icon upload command triggered.");
            await page.waitForTimeout(5000);
        } catch (err) {
            console.warn(`[store-listing-bot] App Icon upload error: ${err.message}`);
        }

        // Upload Feature Graphic
        console.log("[store-listing-bot] Uploading Feature Graphic...");
        try {
            const featureInput = page.locator('section, div').filter({ hasText: /Feature graphic/i }).locator('input[type="file"]').first();
            await featureInput.setInputFiles(featureGraphicPath);
            console.log("[store-listing-bot] Feature Graphic upload command triggered.");
            await page.waitForTimeout(5000);
        } catch (err) {
            console.warn(`[store-listing-bot] Feature Graphic upload error: ${err.message}`);
        }

        // Upload Screenshots
        console.log("[store-listing-bot] Uploading phone screenshots...");
        try {
            const screenshotInput = page.locator('section, div').filter({ hasText: /Phone screenshots/i }).locator('input[type="file"]').first();
            await screenshotInput.setInputFiles(screenshotFiles);
            console.log("[store-listing-bot] Phone screenshots upload command triggered.");
            await page.waitForTimeout(8000);
        } catch (err) {
            console.warn(`[store-listing-bot] Screenshots upload error: ${err.message}`);
        }

        console.log("[store-listing-bot] Saving Store Listing details...");
        const saveListingBtn = page.locator('button:has-text("Save")').first();
        if (await saveListingBtn.count() > 0 && await saveListingBtn.isEnabled()) {
            await saveListingBtn.click();
            console.log("[store-listing-bot] Store listing saved! Waiting 6s for database synchronization...");
            await page.waitForTimeout(6000);
        } else {
            console.log("[store-listing-bot] Warning: 'Save' button not found or is disabled.");
        }

        await page.screenshot({ path: resolve(rootDir, "store_listing_completed.png") });
        console.log("[store-listing-bot] Saved final Store Listing screenshot.");

    } catch (e) {
        console.error("[store-listing-bot] Error:", e.message);
        try {
            await page.screenshot({ path: resolve(rootDir, "store_listing_error.png") });
        } catch (screenshotErr) {}
    } finally {
        await browser.close().catch(() => {});
        console.log("[store-listing-bot] CDP client disconnected safely.");
    }
}

run();
