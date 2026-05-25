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

        // Let's locate the "Country / region" select all checkbox and click it
        console.log("Attempting to find and click the 'Country / region' select-all checkbox...");
        
        const clicked = await page.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('mat-checkbox, [role="checkbox"]'));
            // Find the one that corresponds to header select-all (has label "Country / region" or is the very first one)
            const headerCheckbox = checkboxes.find(cb => {
                const label = cb.getAttribute("aria-label") || "";
                return label.toLowerCase() === "country / region" || label.toLowerCase().includes("select all");
            }) || checkboxes[0];

            if (headerCheckbox) {
                console.log("Found header checkbox:", headerCheckbox.outerHTML);
                headerCheckbox.click();
                return true;
            }
            return false;
        });

        console.log(`Select all checkbox clicked: ${clicked}`);
        await page.waitForTimeout(3000);

        // Take a screenshot to verify selection
        const screenshotPath = resolve(rootDir, "countries_selected.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Check if Save button is enabled
        const buttonStates = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.map(btn => ({
                text: btn.innerText ? btn.innerText.trim() : "",
                enabled: !btn.disabled
            }));
        });
        console.log("Button states after selection:", buttonStates);

        // Find the "Save" or "Add countries / regions" confirmation button and click it
        console.log("Attempting to save selected countries...");
        const clickedSave = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            // Look for Save button that is enabled
            const saveBtn = buttons.find(btn => {
                const text = btn.innerText ? btn.innerText.trim() : "";
                return (text === "Save" || text.includes("Add countries") || text.includes("Save changes")) && !btn.disabled;
            });
            if (saveBtn) {
                saveBtn.click();
                return true;
            }
            return false;
        });
        console.log(`Save button clicked: ${clickedSave}`);
        await page.waitForTimeout(5000);

        const afterSaveScreenshot = resolve(rootDir, "countries_saved.png");
        await page.screenshot({ path: afterSaveScreenshot });
        console.log(`Screenshot after save: ${afterSaveScreenshot}`);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
