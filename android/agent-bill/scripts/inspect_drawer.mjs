import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[inspect-drawer] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // Ensure the drawer is closed first to avoid overlapping states
        console.log("[inspect-drawer] Checking if drawer is already open...");
        const closeBtn = page.locator('aside button[aria-label*="close" i], aside button[aria-label*="Close" i]').first();
        if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
            console.log("[inspect-drawer] Closing open drawer first...");
            await closeBtn.click();
            await page.waitForTimeout(2000);
        }

        // Scroll App Icon into view
        await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
            if (el) el.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(2000);

        console.log("[inspect-drawer] Clicking 'Add assets' for App Icon...");
        await page.evaluate(() => {
            const row = Array.from(document.querySelectorAll("console-form-row")).find(r => r.textContent.includes("App icon"));
            const btn = row.querySelector("button");
            if (btn) btn.click();
        });
        await page.waitForTimeout(5000);

        // Capture screenshot of page with drawer open
        const screenshotPath = resolve(rootDir, "drawer_open_state.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[inspect-drawer] Screenshot saved to ${screenshotPath}`);

        // Dump DOM details of the aside / drawer
        const drawerDetails = await page.evaluate(() => {
            const drawer = document.querySelector("aside, .drawer, div[role='dialog']");
            if (!drawer) return { found: false };
            
            const buttons = Array.from(drawer.querySelectorAll("button")).map(b => ({
                text: b.innerText.trim(),
                ariaLabel: b.getAttribute("aria-label"),
                className: b.className,
                outerHTML: b.outerHTML
            }));

            const inputs = Array.from(drawer.querySelectorAll("input")).map(i => ({
                type: i.getAttribute("type"),
                accept: i.getAttribute("accept"),
                outerHTML: i.outerHTML
            }));

            return {
                found: true,
                tagName: drawer.tagName,
                outerHTML: drawer.outerHTML.substring(0, 1000),
                buttons,
                inputs
            };
        });

        console.log("[inspect-drawer] Drawer Details:", JSON.stringify(drawerDetails, null, 2));
        writeFileSync(resolve(rootDir, "drawer_details.json"), JSON.stringify(drawerDetails, null, 2));

    } catch (e) {
        console.error("[inspect-drawer] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[inspect-drawer] CDP client disconnected.");
    }
}

run();
