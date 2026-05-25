import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[promote-bot] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("store-settings"));
        
        if (!page) {
            console.error("Error: Play Store Settings page not found.");
            return;
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        // --- Step 1: Click "Not now" on the "Go to Publishing overview?" dialog ---
        console.log("[promote-bot] Looking for 'Not now' button...");
        const notNowBtn = page.locator('button:has-text("Not now")').first();
        if (await notNowBtn.count() > 0 && await notNowBtn.isVisible()) {
            console.log("[promote-bot] Clicking 'Not now' to dismiss the overview modal...");
            await notNowBtn.click();
            await page.waitForTimeout(2000);
        } else {
            console.log("[promote-bot] 'Not now' button not found. Maybe the dialog is closed or has close button.");
            const closeX = page.locator('button[aria-label="Close"], button:has-text("close")').last();
            if (await closeX.count() > 0 && await closeX.isVisible()) {
                await closeX.click();
                await page.waitForTimeout(2000);
            }
        }

        // Capture screen to confirm it's back to main settings page
        await page.screenshot({ path: resolve(rootDir, "main_settings_active.png") });
        console.log("[promote-bot] Main settings page screen capture complete.");

        // --- Step 2: Open Contact Details Card ---
        console.log("[promote-bot] Clicking 'Edit' for contact details card...");
        const editButtons = page.locator('button:has-text("Edit")');
        const count = await editButtons.count();
        console.log(`[promote-bot] Visible edit buttons: ${count}`);

        // The second edit button on Store Settings page is contact details
        if (count >= 2) {
            await editButtons.nth(1).click();
            await page.waitForTimeout(2500);
            
            await page.screenshot({ path: resolve(rootDir, "contact_details_modal_open.png") });
            console.log("[promote-bot] Contact details card should be active now.");

            // --- Step 3: Populate Contact Details fields ---
            // Let's find inputs inside the active contact pane
            // We can search all inputs of type text, email, tel
            const textInputs = page.locator('input[type="text"], input[type="email"]');
            const totalInputs = await textInputs.count();
            console.log(`[promote-bot] Total text inputs found: ${totalInputs}`);

            // Fetch input label contexts
            const inputsInfo = await page.evaluate(() => {
                return Array.from(document.querySelectorAll("input[type='text'], input[type='email'], input[type='tel']")).map((el, i) => {
                    const parentText = el.parentElement?.innerText || "";
                    const grandText = el.parentElement?.parentElement?.innerText || "";
                    return {
                        index: i,
                        placeholder: el.placeholder,
                        value: el.value,
                        parentText: parentText.slice(0, 100),
                        grandText: grandText.slice(0, 150)
                    };
                });
            });
            console.log("[promote-bot] Inputs detailed info:", JSON.stringify(inputsInfo, null, 2));

            // Set inputs
            for (let i = 0; i < inputsInfo.length; i++) {
                const info = inputsInfo[i];
                const combined = (info.parentText + " " + info.grandText).toLowerCase();
                const currentField = textInputs.nth(info.index);

                if (combined.includes("email")) {
                    console.log(`[promote-bot] Filling Email field at index ${info.index}...`);
                    await currentField.fill("igor@iganapolsky.com");
                } else if (combined.includes("website") || combined.includes("https")) {
                    console.log(`[promote-bot] Filling Website field at index ${info.index}...`);
                    await currentField.fill("iganapolsky.com");
                } else if (combined.includes("phone")) {
                    console.log(`[promote-bot] Filling Phone field at index ${info.index}...`);
                    await currentField.fill("+12015550123");
                }
            }

            await page.waitForTimeout(1000);
            await page.screenshot({ path: resolve(rootDir, "contact_details_filled.png") });

            // --- Step 4: Click Save on the contact card ---
            console.log("[promote-bot] Clicking Save for contact details...");
            const saveBtn = page.locator('button:has-text("Save")').last();
            await saveBtn.click();
            await page.waitForTimeout(4000); // wait for save API response

            // Dismiss the popup if it shows up again
            console.log("[promote-bot] Checking for final confirmation popup...");
            const finalNotNow = page.locator('button:has-text("Not now")').first();
            if (await finalNotNow.count() > 0 && await finalNotNow.isVisible()) {
                console.log("[promote-bot] Dismissing final overview popup...");
                await finalNotNow.click();
                await page.waitForTimeout(2000);
            }

            console.log("[promote-bot] All steps completed successfully!");
        } else {
            console.error("[promote-bot] Not enough edit buttons found! Only found: " + count);
        }

        // Final settings screenshot
        await page.screenshot({ path: resolve(rootDir, "category_contact_completed.png") });
        console.log("[promote-bot] Final state screenshot saved.");

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
