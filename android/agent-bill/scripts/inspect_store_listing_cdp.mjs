import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const STORE_LISTING_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/main-store-listing`;

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found. Opening a new tab...");
            page = await ctx.newPage();
        } else {
            console.log(`Attaching directly to existing tab: "${await page.title()}"`);
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        console.log(`Navigating to: ${STORE_LISTING_URL}`);
        await page.goto(STORE_LISTING_URL, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        // Take initial screenshot of store listing
        const screenshotPath = resolve(rootDir, "inspect_store_listing_initial.png");
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Saved screenshot to ${screenshotPath}`);

        // Analyze page status
        const info = await page.evaluate(() => {
            // Find all error messages on the page
            const errorElements = Array.from(document.querySelectorAll(".error, .error-message, [aria-invalid='true'], .validation-error, mat-error"));
            const errors = errorElements.map(el => el.innerText ? el.innerText.trim() : "").filter(Boolean);

            // Find value of text fields
            const appName = document.querySelector('input[aria-label="Name of the app"]')?.value || "";
            const shortDesc = document.querySelector('input[aria-label="Short description of the app"]')?.value || "";
            const fullDesc = document.querySelector('textarea[aria-label="Full description of the app"]')?.value || "";

            // Check if Save button is disabled or enabled
            const saveBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText && b.innerText.includes("Save"));
            const saveBtnText = saveBtn ? saveBtn.innerText.trim() : "Not found";
            const saveBtnEnabled = saveBtn ? !saveBtn.disabled : false;

            return { errors, appName, shortDesc, fullDesc: fullDesc.substring(0, 100), saveBtnText, saveBtnEnabled };
        });

        console.log("Store Listing Info:", JSON.stringify(info, null, 2));

    } catch (e) {
        console.error("Error during execution:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("CDP client disconnected safely.");
    }
}

run();
