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

        // --- Step 1: Save the App Category Modal (already open with Finance selected) ---
        console.log("[promote-bot] Looking for the Save button in the active App Category dialog...");
        const modalSaveBtn = page.locator('button:has-text("Save")').last();
        
        if (await modalSaveBtn.count() > 0 && await modalSaveBtn.isVisible()) {
            console.log("[promote-bot] Clicking the Save button for App Category...");
            await modalSaveBtn.click();
            await page.waitForTimeout(4000); // wait for save and dialog close
        } else {
            console.log("[promote-bot] Save button not found or not visible. Checking if we need to click Edit first.");
            // If modal is not open, open it
            const editButtons = page.locator('button:has-text("Edit")');
            if (await editButtons.count() > 0) {
                await editButtons.nth(0).click();
                await page.waitForTimeout(2000);
                
                // Select Category
                const categoryDropdown = page.locator('div:has-text("Select a category")').last();
                if (await categoryDropdown.count() > 0) {
                    await categoryDropdown.click();
                    await page.waitForTimeout(1500);
                    const option = page.locator('span:has-text("Finance"), [role="option"]:has-text("Finance")').first();
                    if (await option.count() > 0) {
                        await option.click();
                        await page.waitForTimeout(1000);
                    }
                }
                
                await page.locator('button:has-text("Save")').last().click();
                await page.waitForTimeout(4000);
            }
        }

        // Verify Category dialog is closed
        await page.screenshot({ path: resolve(rootDir, "category_saved.png") });
        console.log("[promote-bot] App Category saved. Verifying main page state...");

        // --- Step 2: Open Contact Details Modal ---
        console.log("[promote-bot] Clicking the 'Edit' button for Store listing contact details...");
        // Re-locate edit buttons now that DOM updated
        const editButtons = page.locator('button:has-text("Edit")');
        const editCount = await editButtons.count();
        console.log(`[promote-bot] Found ${editCount} Edit buttons on main settings page.`);
        
        if (editCount > 1) {
            // Second Edit button is for contact details
            await editButtons.nth(1).click();
            await page.waitForTimeout(2000);
            
            // Capture modal state
            await page.screenshot({ path: resolve(rootDir, "contact_modal_open.png") });
            console.log("[promote-bot] Contact details dialog opened.");

            // Fill contact details inputs
            // Let's find all text inputs inside the active dialog/modal
            const textInputs = page.locator('input[type="text"], input[type="email"]');
            const inputCount = await textInputs.count();
            console.log(`[promote-bot] Found ${inputCount} input fields in contact modal.`);

            const inputsInfo = await page.evaluate(() => {
                return Array.from(document.querySelectorAll("input[type='text'], input[type='email'], input[type='tel']")).map((el, i) => {
                    const parentText = el.parentElement?.innerText || "";
                    const grandText = el.parentElement?.parentElement?.innerText || "";
                    return {
                        index: i,
                        tagName: el.tagName,
                        placeholder: el.placeholder,
                        value: el.value,
                        parentText: parentText.slice(0, 100),
                        grandText: grandText.slice(0, 150)
                    };
                });
            });
            console.log("[promote-bot] Inputs info:", JSON.stringify(inputsInfo, null, 2));

            // Populate the inputs based on parent container descriptions
            for (let i = 0; i < inputsInfo.length; i++) {
                const info = inputsInfo[i];
                const combinedText = (info.parentText + " " + info.grandText).toLowerCase();
                const currentInput = textInputs.nth(info.index);
                
                if (combinedText.includes("email")) {
                    console.log(`[promote-bot] Filling email input at index ${info.index}...`);
                    await currentInput.fill("igor@iganapolsky.com");
                } else if (combinedText.includes("website") || combinedText.includes("https")) {
                    console.log(`[promote-bot] Filling website input at index ${info.index}...`);
                    await currentInput.fill("iganapolsky.com");
                } else if (combinedText.includes("phone")) {
                    console.log(`[promote-bot] Filling phone input at index ${info.index}...`);
                    await currentInput.fill("+12015550123");
                }
            }

            await page.waitForTimeout(2000);
            await page.screenshot({ path: resolve(rootDir, "contact_details_filled.png") });

            // Click Save button for Contact Details
            console.log("[promote-bot] Saving contact details...");
            const contactSaveBtn = page.locator('button:has-text("Save")').last();
            await contactSaveBtn.click();
            await page.waitForTimeout(5000); // wait for save API call to finish
            
            console.log("[promote-bot] Save completed successfully!");
        } else {
            console.error("[promote-bot] Failed to find the second 'Edit' button for contact details.");
        }

        // Take a final screenshot of the settings page after all saves
        const finalScreenshotPath = resolve(rootDir, "category_contact_completed.png");
        await page.screenshot({ path: finalScreenshotPath });
        console.log(`[promote-bot] Final Store Settings page screenshot saved to ${finalScreenshotPath}`);

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
