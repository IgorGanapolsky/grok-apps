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

        console.log("Current Page URL:", page.url());

        // Locate and print all buttons on the page to see their texts and visibility
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button')).map(btn => ({
                text: btn.innerText ? btn.innerText.trim() : "",
                visible: btn.getBoundingClientRect().width > 0 && btn.getBoundingClientRect().height > 0,
                disabled: btn.disabled,
                outerHTML: btn.outerHTML.substring(0, 150)
            }));
        });

        console.log("Buttons found on page:");
        buttons.forEach((btn, idx) => {
            console.log(`  Button #${idx}: "${btn.text}" | Visible: ${btn.visible} | Disabled: ${btn.disabled} | HTML: ${btn.outerHTML}`);
        });

        // Click "Next"
        console.log("Attempting to click 'Next' button...");
        const clickedNext = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const nextBtn = btns.find(btn => {
                const text = btn.innerText ? btn.innerText.trim() : "";
                return text === "Next" && btn.getBoundingClientRect().width > 0;
            });
            if (nextBtn) {
                nextBtn.click();
                return true;
            }
            return false;
        });

        console.log(`Clicked 'Next' button via DOM: ${clickedNext}`);
        if (!clickedNext) {
            console.log("Trying locator for 'Next' button...");
            await page.locator('button:has-text("Next")').first().click();
        }

        console.log("Waiting 8 seconds for page transition...");
        await page.waitForTimeout(8000);

        const screenshotPath = resolve(rootDir, "alpha_review_page_loaded.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
