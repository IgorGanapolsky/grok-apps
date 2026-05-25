import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("[rollout] Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("[rollout] No Play Console tab found. Opening a new one...");
            page = await ctx.newPage();
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        const trackUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/tracks/internal-testing`;
        console.log(`[rollout] Navigating to: ${trackUrl}`);
        await page.goto(trackUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        // Click Edit Release
        console.log("[rollout] Searching for 'Edit release' button...");
        const editButton = page.locator('button:has-text("Edit release")').first();
        if (await editButton.count() > 0) {
            console.log("[rollout] Clicking 'Edit release' button...");
            await editButton.click();
            await page.waitForTimeout(6000);
        } else {
            console.log("[rollout] 'Edit release' button not found. Checking if already in editor...");
        }

        console.log(`[rollout] Editor page title: "${await page.title()}"`);
        console.log(`[rollout] Editor page URL: ${page.url()}`);
        await page.screenshot({ path: resolve(rootDir, "release_edit_editor.png") });

        // In editor, click "Next" or "Review release"
        console.log("[rollout] Advancing to review screen...");
        const nextButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
            console.log("[rollout] Clicking 'Next' / 'Review release' button...");
            await nextButton.click();
            await page.waitForTimeout(6000);
        } else {
            console.log("[rollout] Next/Review button is either not found or disabled. Checking page...");
            // Let's dump all text to see if there's any validation error or warnings blocking us
            const pageText = await page.innerText("body");
            console.log("[rollout] Page text check: has errors?", pageText.toLowerCase().includes("error"));
        }

        console.log(`[rollout] Review page title: "${await page.title()}"`);
        console.log(`[rollout] Review page URL: ${page.url()}`);
        await page.screenshot({ path: resolve(rootDir, "release_review_page.png") });

        // On review page, click "Start rollout to Internal testing"
        console.log("[rollout] Searching for rollout confirmation button...");
        const rolloutButton = page.locator('button:has-text("Start rollout to Internal testing"), button:has-text("Save")').first();
        if (await rolloutButton.count() > 0 && await rolloutButton.isEnabled()) {
            console.log("[rollout] Clicking rollout/publish button...");
            await rolloutButton.click();
            await page.waitForTimeout(6000);
            
            // Check if there is a secondary confirmation dialog modal
            console.log("[rollout] Checking for secondary confirmation dialog...");
            const confirmDialogBtn = page.locator('[role="dialog"] button:has-text("Rollout"), [role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Publish")').first();
            if (await confirmDialogBtn.count() > 0 && await confirmDialogBtn.isVisible()) {
                console.log("[rollout] Confirmation dialog found! Clicking confirm button...");
                await confirmDialogBtn.click();
                await page.waitForTimeout(6000);
            }
        } else {
            console.log("[rollout] Rollout button not found or disabled.");
        }

        console.log(`[rollout] Final page title: "${await page.title()}"`);
        console.log(`[rollout] Final page URL: ${page.url()}`);
        await page.screenshot({ path: resolve(rootDir, "release_rollout_complete.png") });
        console.log("[rollout] Release rollout process completed!");

    } catch (e) {
        console.error("[rollout] Error occurred during rollout:", e.message);
        await page.screenshot({ path: resolve(rootDir, "release_rollout_error.png") }).catch(() => {});
    } finally {
        await browser.close().catch(() => {});
        console.log("[rollout] Disconnected successfully.");
    }
}
run();
