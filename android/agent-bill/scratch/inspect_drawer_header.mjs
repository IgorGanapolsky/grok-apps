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

        // Open Phone screenshots drawer
        console.log("Opening Phone screenshots drawer...");
        const rowLocator = page.locator('console-form-row').filter({ hasText: /Phone screenshots/i });
        const addBtnLocator = rowLocator.locator('button[debug-id="add-button"], button[debug-id="add-more-button"]').first();
        await addBtnLocator.click();
        await page.waitForTimeout(4000);

        // Find all buttons inside material-drawer that are not in asset-list-row
        const headerButtons = await page.evaluate(() => {
            const drawer = document.querySelector("material-drawer");
            if (!drawer) return "No drawer found";
            
            // Exclude buttons inside asset-list-row to focus on header/footer
            const allBtns = Array.from(drawer.querySelectorAll("button, [role='button'], a"));
            const filtered = allBtns.filter(b => !b.closest("asset-list-row"));
            
            return filtered.map(b => ({
                tagName: b.tagName,
                outerHTML: b.outerHTML,
                innerText: b.innerText,
                disabled: b.disabled || b.getAttribute("aria-disabled"),
                debugId: b.getAttribute("debug-id")
            }));
        });

        console.log("Filtered Drawer Buttons:", JSON.stringify(headerButtons, null, 2));

        // Close drawer
        const closeBtn = page.locator('material-drawer button[debug-id="close-button"]').first();
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
