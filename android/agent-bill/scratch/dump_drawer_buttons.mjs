import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP...");
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

        // Close drawer first
        console.log("Closing drawer first...");
        const closeBtn = page.locator('material-drawer button[debug-id="close-button"]').first();
        if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(2000);
        }

        // Open Phone screenshots drawer
        console.log("Opening Phone screenshots drawer...");
        const rowLocator = page.locator('console-form-row').filter({ hasText: /Phone screenshots/i });
        const addBtnLocator = rowLocator.locator('button[debug-id="add-button"]');
        if (await addBtnLocator.count() > 0) {
            await addBtnLocator.click();
        } else {
            console.log("Falling back to first button in row");
            await rowLocator.locator('button').first().click();
        }
        await page.waitForTimeout(4000);

        // Dump drawer buttons
        const buttons = await page.evaluate(() => {
            const drawer = document.querySelector("material-drawer");
            if (!drawer) return "No drawer found";
            const btnEls = Array.from(drawer.querySelectorAll("button, [role='button'], a"));
            return btnEls.map(b => ({
                tagName: b.tagName,
                outerHTML: b.outerHTML,
                innerText: b.innerText,
                disabled: b.disabled || b.getAttribute("aria-disabled")
            }));
        });

        console.log("Drawer Buttons:", JSON.stringify(buttons, null, 2));

        // Close drawer
        if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
            await closeBtn.click();
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
