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

        // Locate and click the "Countries / regions" tab
        const countriesTab = page.locator('[role="tab"]:has-text("Countries / regions")').first();
        if (await countriesTab.count() > 0) {
            console.log("Found Countries / regions tab. Clicking...");
            await countriesTab.click();
            await page.waitForTimeout(3000);
        } else {
            console.log("Countries / regions tab NOT found via locator. Attempting page.evaluate...");
            const clicked = await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('[role="tab"], button, div, span'));
                const tab = tabs.find(t => t.textContent && t.textContent.includes("Countries / regions"));
                if (tab) {
                    tab.click();
                    return true;
                }
                return false;
            });
            console.log(`Click result via evaluate: ${clicked}`);
            await page.waitForTimeout(3000);
        }

        const screenshotPath = resolve(rootDir, "countries_tab.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Dump interactive buttons or text in the country/region list
        const info = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a, input')).map(el => ({
                tagName: el.tagName.toLowerCase(),
                text: el.innerText ? el.innerText.trim() : "",
                role: el.getAttribute("role") || "",
                type: el.getAttribute("type") || "",
                ariaLabel: el.getAttribute("aria-label") || ""
            })).filter(b => b.text.length > 0 || b.ariaLabel.length > 0 || b.tagName === "input");
            return { buttons, text: document.body.innerText };
        });

        console.log("\n--- BUTTONS / INPUTS ---");
        console.log(info.buttons.filter(b => b.text.includes("country") || b.text.includes("Country") || b.text.includes("Add") || b.text.includes("Select") || b.text.includes("Save")));
        console.log("------------------------\n");

        console.log("\n--- BODY TEXT ON COUNTRIES TAB (FIRST 2000 CHARS) ---");
        console.log(info.text.substring(0, 2000));
        console.log("-----------------------------------------------------\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
