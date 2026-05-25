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

        // --- Step 1: Open Contact Details Card ---
        console.log("[promote-bot] Clicking the second 'Edit' button for contact details...");
        const editButtons = page.locator('button:has-text("Edit")');
        const count = await editButtons.count();
        console.log(`[promote-bot] Visible edit buttons: ${count}`);

        if (count >= 2) {
            // Click the second one
            await editButtons.nth(1).click();
            await page.waitForTimeout(3000);
            
            await page.screenshot({ path: resolve(rootDir, "contact_modal_open_only.png") });
            console.log("[promote-bot] Contact modal opened.");

            // --- Step 2: Fill text fields ---
            // In the contact modal, find all text inputs (email, web, phone)
            const textInputs = page.locator('input[type="text"], input[type="email"]');
            const totalInputs = await textInputs.count();
            console.log(`[promote-bot] Total text inputs in modal: ${totalInputs}`);

            // Inspect the parents/labels of each input to match correctly
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
            console.log("[promote-bot] Inputs info:", JSON.stringify(inputsInfo, null, 2));

            // Set inputs
            for (let i = 0; i < inputsInfo.length; i++) {
                const info = inputsInfo[i];
                const combined = (info.parentText + " " + info.grandText).toLowerCase();
                const currentField = textInputs.nth(info.index);

                if (combined.includes("email")) {
                    console.log(`[promote-bot] Filling Email at index ${info.index}...`);
                    await currentField.fill("igor@iganapolsky.com");
                } else if (combined.includes("website") || combined.includes("https")) {
                    console.log(`[promote-bot] Filling Website at index ${info.index}...`);
                    await currentField.fill("iganapolsky.com");
                } else if (combined.includes("phone")) {
                    console.log(`[promote-bot] Filling Phone at index ${info.index}...`);
                    await currentField.fill("+12015550123");
                }
            }

            await page.waitForTimeout(2000);
            await page.screenshot({ path: resolve(rootDir, "contact_details_filled_only.png") });

            // --- Step 3: Click Save on the contact card ---
            console.log("[promote-bot] Clicking Save button in contact details modal...");
            const saveBtn = page.locator('button:has-text("Save")').last();
            await saveBtn.click();
            await page.waitForTimeout(5000); // wait for save API response

            await page.screenshot({ path: resolve(rootDir, "contact_details_saved_state.png") });

            // --- Step 4: Dismiss "Go to Publishing overview?" ---
            console.log("[promote-bot] Dismissing publishing overview popup if present...");
            const finalNotNow = page.locator('button:has-text("Not now")').first();
            if (await finalNotNow.count() > 0 && await finalNotNow.isVisible()) {
                console.log("[promote-bot] Clicking 'Not now'...");
                await finalNotNow.click();
                await page.waitForTimeout(2000);
            }

            // --- Step 5: Close Contact modal ---
            console.log("[promote-bot] Closing contact modal...");
            const closeX = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button:has-text("close"), button:has-text("close")');
            const closeCount = await closeX.count();
            let closed = false;
            for (let i = 0; i < closeCount; i++) {
                const btn = closeX.nth(i);
                if (await btn.isVisible()) {
                    console.log(`[promote-bot] Clicking visible close button at index ${i}...`);
                    await btn.click();
                    closed = true;
                    break;
                }
            }
            if (!closed) {
                console.log("[promote-bot] Clicking first close button by selector...");
                await page.locator('button[aria-label="Close"]').first().click();
            }

            await page.waitForTimeout(3000);
            console.log("[promote-bot] Contact Details step complete.");
        } else {
            console.error("[promote-bot] Could not find at least 2 edit buttons. Edit buttons found: " + count);
        }

        // Final settings page screenshot
        await page.screenshot({ path: resolve(rootDir, "category_contact_completed.png") });
        console.log("[promote-bot] Store settings fully completed and screenshotted!");

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
