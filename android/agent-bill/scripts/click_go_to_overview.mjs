import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found.");
            return;
        }

        console.log("Current Page URL before clicking Go to overview:", page.url());

        // Click "Go to overview" button
        const overviewBtn = page.locator('button:has-text("Go to overview")').first();
        if (await overviewBtn.count() > 0 && await overviewBtn.isVisible()) {
            console.log("Clicking 'Go to overview' button in the modal...");
            await overviewBtn.click();
            await page.waitForTimeout(8000); // Wait for transition
        } else {
            console.log("'Go to overview' button not found or not visible.");
            // If the modal was already dismissed or didn't show up, let's try direct navigation to publishing overview
            const devIdMatch = page.url().match(/developers\/(\d+)/);
            const appIdMatch = page.url().match(/app\/(\d+)/);
            if (devIdMatch && appIdMatch) {
                const devId = devIdMatch[1];
                const appId = appIdMatch[1];
                const publishingOverviewUrl = `https://play.google.com/console/u/0/developers/${devId}/app/${appId}/publishing`;
                console.log(`Directly navigating to publishing overview: ${publishingOverviewUrl}`);
                await page.goto(publishingOverviewUrl, { waitUntil: "networkidle", timeout: 60000 });
                await page.waitForTimeout(6000);
            }
        }

        console.log("Current Page URL after action:", page.url());
        const screenshotPath = resolve(rootDir, "alpha_publishing_overview_page.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
