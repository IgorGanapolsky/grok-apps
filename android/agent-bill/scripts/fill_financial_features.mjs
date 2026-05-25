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
        if (contexts.length === 0) throw new Error("No contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found. Opening a new one...");
            page = await ctx.newPage();
        }

        const targetUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-content/overview";
        console.log(`Ensuring we are on: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(5000);

        console.log("Locating Financial features container...");
        const containers = page.locator('div, section, tr, li, [role="listitem"]').filter({ hasText: /^Financial features/ });
        
        // Let's filter to the smallest container containing "Financial features" that has the "Start declaration" button
        const matchCount = await containers.count();
        console.log(`Found ${matchCount} potential financial containers.`);
        
        let foundBtn = null;
        for (let i = 0; i < matchCount; i++) {
            const btn = containers.nth(i).locator('button:has-text("Start declaration")');
            if (await btn.count() > 0) {
                console.log(`Found "Start declaration" button in container #${i}! Clicking it...`);
                foundBtn = btn;
                break;
            }
        }

        if (!foundBtn) {
            throw new Error("Could not find 'Start declaration' button for Financial features.");
        }

        await foundBtn.click();
        console.log("Clicked! Waiting 5 seconds for navigation...");
        await page.waitForTimeout(5000);

        console.log(`Current page title: "${await page.title()}"`);
        console.log(`Current page URL: ${page.url()}`);

        // Screenshot the current state
        await page.screenshot({ path: resolve(rootDir, "financial_features_form_loaded.png") });
        console.log("Screenshot saved to financial_features_form_loaded.png");

        // Let's inspect form inputs, text, and labels
        const formData = await page.evaluate(() => {
            const radioButtons = Array.from(document.querySelectorAll("input[type='radio']")).map(el => {
                const label = el.nextElementSibling || el.parentElement;
                return {
                    id: el.id || "",
                    value: el.value || "",
                    labelText: label ? label.innerText.trim().replace(/\n/g, ' ') : "No label",
                    checked: el.checked
                };
            });
            const checkboxes = Array.from(document.querySelectorAll("input[type='checkbox']")).map(el => {
                const label = el.nextElementSibling || el.parentElement;
                return {
                    id: el.id || "",
                    labelText: label ? label.innerText.trim().replace(/\n/g, ' ') : "No label",
                    checked: el.checked
                };
            });
            const headings = Array.from(document.querySelectorAll("h1, h2, h3, [role='heading']")).map(h => h.innerText.trim());
            const bodyTexts = Array.from(document.querySelectorAll("p, label, span.text")).map(t => t.innerText.trim()).filter(t => t.length > 50 && t.length < 300);

            return { radioButtons, checkboxes, headings, bodyTexts };
        });

        console.log("Headings on form page:", formData.headings);
        console.log("Radio buttons available:", JSON.stringify(formData.radioButtons, null, 2));
        console.log("Checkboxes available:", JSON.stringify(formData.checkboxes, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
