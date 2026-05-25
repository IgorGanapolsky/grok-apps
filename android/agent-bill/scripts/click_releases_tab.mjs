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

        console.log("Page URL:", page.url());

        // Find the "Releases" tab button/element and click it
        console.log("Searching for 'Releases' tab...");
        const clicked = await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('div, span, a, [role="tab"]'));
            const releasesTab = tabs.find(t => {
                const text = t.innerText ? t.innerText.trim() : "";
                return text === "Releases" && t.getBoundingClientRect().width > 0;
            });
            if (releasesTab) {
                console.log("Found Releases tab element:", releasesTab.outerHTML);
                releasesTab.click();
                return true;
            }
            return false;
        });

        console.log(`Releases tab clicked: ${clicked}`);
        await page.waitForTimeout(4000);

        const screenshotPath = resolve(rootDir, "releases_tab_active.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
