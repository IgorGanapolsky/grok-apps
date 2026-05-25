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
        console.log(`Found tab: "${await page.title()}"`);
        console.log(`URL: ${page.url()}`);

        // Click all elements containing "Show more" via evaluate
        const clickedCount = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const showMoreBtns = buttons.filter(btn => btn.innerText && btn.innerText.includes("Show more"));
            showMoreBtns.forEach((btn, idx) => {
                console.log(`Clicking button #${idx} via DOM element.click()`);
                btn.click();
            });
            return showMoreBtns.length;
        });

        console.log(`Successfully clicked ${clickedCount} 'Show more' buttons via page.evaluate`);

        // Wait a bit
        await page.waitForTimeout(2000);

        // Capture screenshot
        const screenshotPath = resolve(rootDir, "error_details.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Extract page text in the errors area
        const pageText = await page.evaluate(() => {
            return document.body.innerText;
        });

        console.log("\n--- PAGE CONTENT DUMP (FIRST 3000 CHARS) ---");
        console.log(pageText.substring(0, 3000));
        console.log("------------------------------------------\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
