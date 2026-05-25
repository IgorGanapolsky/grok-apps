import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const INTERNAL_TESTING_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/tracks/internal-testing`;

async function run() {
    console.log("[promote-alpha] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) page = await ctx.newPage();

        await page.setViewportSize({ width: 1440, height: 900 });

        console.log(`[promote-alpha] Navigating to: ${INTERNAL_TESTING_URL}`);
        await page.goto(INTERNAL_TESTING_URL, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(6000);

        console.log("[promote-alpha] Finding 'Promote release' button...");
        const promoteBtn = page.locator('button:has-text("Promote release"), button[aria-label="Promote release"]').first();
        if (await promoteBtn.count() === 0) {
            throw new Error("Promote release button not found.");
        }

        console.log("[promote-alpha] Clicking 'Promote release' button...");
        await promoteBtn.click();
        await page.waitForTimeout(2000);

        console.log("[promote-alpha] Hovering over 'Closed testing' item...");
        const closedItem = page.locator('material-select-item:has-text("Closed testing")').first();
        if (await closedItem.count() === 0) {
            throw new Error("Closed testing menu item not found.");
        }
        await closedItem.hover();
        await page.waitForTimeout(4000);

        console.log("[promote-alpha] Searching for 'Closed testing - Alpha' element in submenu...");
        // Search specifically for leaf elements containing exactly "Closed testing - Alpha"
        const clickedAlpha = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll('span, div, material-select-item, [role="menuitem"]'));
            const alpha = els.find(el => {
                const text = el.textContent ? el.textContent.trim() : "";
                return text === "Closed testing - Alpha";
            });
            if (alpha) {
                alpha.click();
                // Click parent as well to be absolutely sure
                if (alpha.parentElement) alpha.parentElement.click();
                return true;
            }
            return false;
        });

        if (!clickedAlpha) {
            console.log("[promote-alpha] Could not click via DOM search. Attempting direct locator click...");
            const alphaItem = page.locator('span:has-text("Closed testing - Alpha"), material-select-item:has-text("Closed testing - Alpha")').first();
            await alphaItem.click();
        }

        console.log("[promote-alpha] Waiting for transition/navigation...");
        await page.waitForTimeout(10000);

        console.log(`[promote-alpha] Current page title: "${await page.title()}"`);
        console.log(`[promote-alpha] Current page URL: ${page.url()}`);
        
        await page.screenshot({ path: resolve(rootDir, "promote_closed_navigated.png"), fullPage: true });
        console.log("[promote-alpha] Staging screenshot captured.");

        if (!page.url().includes("/tracks/alpha")) {
            throw new Error("Failed to navigate to Closed testing (Alpha) track preparation screen.");
        }

        // On Alpha release prepare screen
        console.log("[promote-alpha] On Alpha track preparation screen. Checking buttons...");
        
        // Wait for page loading/processing
        await page.waitForTimeout(5000);

        // Click "Save" if enabled/visible
        console.log("[promote-alpha] Checking for 'Save' button...");
        const saveButton = page.locator('button:has-text("Save")').first();
        if (await saveButton.count() > 0 && await saveButton.isEnabled()) {
            console.log("[promote-alpha] Clicking 'Save' button...");
            await saveButton.click();
            await page.waitForTimeout(5000);
        } else {
            console.log("[promote-alpha] Save button not clickable or not found. Moving to Next...");
        }

        // Click "Next" / "Review release"
        console.log("[promote-alpha] Clicking 'Next' or 'Review release' button...");
        const nextButton = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
        if (await nextButton.count() > 0) {
            console.log("[promote-alpha] Clicking 'Next'...");
            await nextButton.click();
            await page.waitForTimeout(8000);
        } else {
            throw new Error("Could not find Next or Review release button.");
        }

        console.log(`[promote-alpha] Post-Next page URL: ${page.url()}`);
        await page.screenshot({ path: resolve(rootDir, "promote_closed_review.png"), fullPage: true });

        // Verify we are on the final review/confirm page
        // On this page, click "Start rollout to Closed testing - Alpha" (or similar button text)
        console.log("[promote-alpha] Searching for rollout button...");
        const rolloutButton = page.locator('button:has-text("Start rollout to Closed testing - Alpha"), button:has-text("Rollout"), button:has-text("Save")').first();
        if (await rolloutButton.count() > 0 && await rolloutButton.isEnabled()) {
            console.log("[promote-alpha] Clicking rollout button...");
            await rolloutButton.click();
            await page.waitForTimeout(6000);

            // Handle secondary confirmation dialog if it shows up
            console.log("[promote-alpha] Checking for secondary confirmation modal...");
            const confirmDialogBtn = page.locator('[role="dialog"] button:has-text("Rollout"), [role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Publish")').first();
            if (await confirmDialogBtn.count() > 0 && await confirmDialogBtn.isVisible()) {
                console.log("[promote-alpha] Confirmation modal visible. Clicking confirm button...");
                await confirmDialogBtn.click();
                await page.waitForTimeout(8000);
            }
        } else {
            console.log("[promote-alpha] Rollout button not found or not enabled.");
        }

        console.log(`[promote-alpha] Final page URL: ${page.url()}`);
        console.log(`[promote-alpha] Final page title: "${await page.title()}"`);
        await page.screenshot({ path: resolve(rootDir, "promote_closed_complete.png"), fullPage: true });
        console.log("[promote-alpha] Script run completed successfully.");

    } catch (e) {
        console.error("[promote-alpha] Error:", e.message);
        try {
            await page.screenshot({ path: resolve(rootDir, "promote_closed_error.png"), fullPage: true });
        } catch (_) {}
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-alpha] Disconnected.");
    }
}

run();
