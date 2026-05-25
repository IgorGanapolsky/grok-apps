import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("[rollout-bot] Connecting to Comet...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        
        await page.setViewportSize({ width: 1440, height: 900 });

        // Navigate to internal testing track first if needed
        const trackUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/tracks/internal-testing`;
        console.log(`[rollout-bot] Navigating directly to Internal Testing track: ${trackUrl}`);
        await page.goto(trackUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(5000);

        console.log("[rollout-bot] Clicking 'Edit release' button...");
        const editBtn = page.locator('button[debug-id="edit-draft-release-button"]').first();
        if (await editBtn.count() > 0) {
            await editBtn.click();
            console.log("[rollout-bot] Clicked 'Edit release'. Waiting 5 seconds for page load...");
            await page.waitForTimeout(5000);
        } else {
            console.log("[rollout-bot] Edit release button not found. Maybe we are already on the release form?");
        }

        const screenshotPath = resolve(rootDir, "edit_release_page.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[rollout-bot] Screenshot saved to ${screenshotPath}`);

        // Analyze form elements
        const formAnalysis = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button, a, [role='button']")).map(el => ({
                tagName: el.tagName,
                text: el.innerText ? el.innerText.trim().replace(/\n/g, " ") : "",
                debugId: el.getAttribute("debug-id"),
                ariaLabel: el.getAttribute("aria-label"),
                disabled: el.disabled || el.getAttribute("aria-disabled") === "true",
                className: el.className
            })).filter(b => b.text || b.ariaLabel || b.debugId);

            const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4")).map(h => h.innerText.trim());

            return {
                title: document.title,
                url: window.location.href,
                headings,
                buttons
            };
        });

        console.log("[rollout-bot] Form Analysis:", JSON.stringify(formAnalysis, null, 2));
        writeFileSync(resolve(rootDir, "edit_release_analysis.json"), JSON.stringify(formAnalysis, null, 2));

    } catch (e) {
        console.error("[rollout-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[rollout-bot] CDP client disconnected safely.");
    }
}

run();
