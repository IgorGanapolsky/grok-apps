import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("[promote-bot] Connecting to Comet...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        
        await page.setViewportSize({ width: 1440, height: 900 });

        const dashboardUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-dashboard`;
        console.log(`[promote-bot] Navigating directly to App Dashboard: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        // Click "View tasks" under "Identify issues in your app..." if it exists
        console.log("[promote-bot] Expanding Closed Testing tasks...");
        const viewTasksBtns = await page.locator('button:has-text("View tasks")').all();
        console.log(`[promote-bot] Found ${viewTasksBtns.length} "View tasks" buttons.`);
        for (const btn of viewTasksBtns) {
            await btn.click().catch(() => {});
            await page.waitForTimeout(1000);
        }

        // Expand any other task groups if they are collapsed
        const collapsedBtns = await page.locator('button:has-text("expand_more")').all();
        console.log(`[promote-bot] Found ${collapsedBtns.length} other expandable buttons.`);
        for (const btn of collapsedBtns) {
            const text = await btn.innerText();
            if (text.includes("completed tasks") || text.includes("View tasks") || text.includes("complete")) {
                await btn.click().catch(() => {});
                await page.waitForTimeout(1000);
            }
        }

        const screenshotPath = resolve(rootDir, "dashboard_tasks_expanded.png");
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[promote-bot] Expanded dashboard screenshot saved to ${screenshotPath}`);

        // Analyze tasks
        const tasksAnalysis = await page.evaluate(() => {
            const taskElements = Array.from(document.querySelectorAll(".task-available, .task-completed, .task-locked, [_ngcontent-cxe-69]"));
            return taskElements.map(el => ({
                text: el.innerText ? el.innerText.trim().replace(/\n/g, " ") : "",
                className: el.className,
                tagName: el.tagName
            })).filter(t => t.text);
        });

        console.log("[promote-bot] Task List Analysis:", JSON.stringify(tasksAnalysis, null, 2));
        writeFileSync(resolve(rootDir, "dashboard_tasks_analysis.json"), JSON.stringify(tasksAnalysis, null, 2));

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected safely.");
    }
}

run();
