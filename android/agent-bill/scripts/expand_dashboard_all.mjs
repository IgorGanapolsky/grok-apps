import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("Connecting to Comet...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");

        const dashboardUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-dashboard";
        console.log(`Navigating to Dashboard: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(5000);

        console.log("Looking for accordion headers to expand...");
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button, div, span"));
            // Find "10 of 11 complete" or similar
            const header = buttons.find(b => b.innerText && b.innerText.includes("10 of 11 complete"));
            if (header) {
                console.log("Found '10 of 11 complete', clicking...");
                const clickable = header.closest('button') || header.closest('summary') || header;
                clickable.click();
            } else {
                console.log("'10 of 11 complete' not found directly. Let's try expanding all expand_more buttons.");
            }

            // Click all elements containing 'expand_more' icon or button
            const icons = Array.from(document.querySelectorAll('mat-icon, .material-icons, button'));
            icons.forEach(icon => {
                const txt = icon.innerText || "";
                if (txt.includes("expand_more") || txt.includes("10 of 11")) {
                    const clickable = icon.closest('button') || icon;
                    clickable.click();
                }
            });
        });

        await page.waitForTimeout(4000);
        await page.screenshot({ path: resolve(rootDir, "dashboard_expanded_all.png"), fullPage: true });
        console.log("Saved dashboard_expanded_all.png");

        // Let's dump all visible text matching tasks
        const tasks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("div, span, a"))
                .map(el => el.innerText ? el.innerText.trim() : "")
                .filter(t => t.includes("complete") || t.includes("listing") || t.includes("testers") || t.includes("Policy"));
        });
        console.log("Tasks found:", tasks.slice(0, 30));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("Disconnected.");
    }
}
run();
