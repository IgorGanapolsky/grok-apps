import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const TRACK_URL = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/tracks/4698607147862798883";

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
        console.log(`Navigating to track dashboard: ${TRACK_URL}`);
        await page.goto(TRACK_URL, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(5000);

        const screenshotPath = resolve(rootDir, "track_dashboard.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Let's dump all text or tab elements
        const tabsInfo = await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('[role="tab"], button, a')).map(el => ({
                role: el.getAttribute("role") || el.tagName.toLowerCase(),
                text: el.innerText ? el.innerText.trim() : "",
                href: el.getAttribute("href") || ""
            })).filter(t => t.text.length > 0);
            return { tabs, text: document.body.innerText };
        });

        console.log("\n--- FOUND INTERACTIVE TABS/BUTTONS/LINKS ---");
        console.log(tabsInfo.tabs.filter(t => t.text.includes("Countries") || t.text.includes("Tester") || t.text.includes("Region")));
        console.log("-------------------------------------------\n");

        console.log("\n--- PAGE INNERTEXT ---");
        console.log(tabsInfo.text.substring(0, 3000));
        console.log("----------------------\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
