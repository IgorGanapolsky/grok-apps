import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found. Opening a new one...");
            page = await ctx.newPage();
        }

        const internalTestingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/tracks/internal-testing`;
        console.log(`Navigating to Internal testing track: ${internalTestingUrl}`);
        await page.goto(internalTestingUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(5000);

        console.log("Clicking 'Edit release' link...");
        const editLink = page.locator('a:has-text("Edit release")').first();
        if (await editLink.count() > 0) {
            await editLink.click();
            console.log("Clicked 'Edit release'. Waiting 6 seconds...");
            await page.waitForTimeout(6000);
        } else {
            console.log("'Edit release' link not found.");
        }

        console.log(`Current page title: "${await page.title()}"`);
        console.log(`Current page URL: ${page.url()}`);

        // Capture screenshot of the edit release form
        const screenshotPath = resolve(rootDir, "agentbill_edit_release_page.png");
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Extract some text from the form to understand its elements
        const formText = await page.innerText("body");
        console.log("Form includes 'App bundles':", formText.includes("App bundles") || formText.includes("app bundle"));
        console.log("Form includes 'Release notes':", formText.includes("Release notes") || formText.includes("release notes"));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("Disconnected successfully.");
    }
}
run();
