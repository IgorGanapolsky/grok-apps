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
            console.error("Error: Play Store Settings page not found. Please navigate to it first.");
            return;
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        // --- Step 1: Fill App Category ---
        console.log("[promote-bot] Clicking the first 'Edit' button for App Category...");
        const editButtons = page.locator('button:has-text("Edit")');
        const editCount = await editButtons.count();
        console.log(`[promote-bot] Found ${editCount} Edit buttons.`);
        
        if (editCount > 0) {
            // Let's click the first one (App category)
            await editButtons.nth(0).click();
            await page.waitForTimeout(2000);
            
            // Capture and inspect the elements under "App category"
            const selectDropdown = page.locator('div[role="listbox"], select, div:has-text("Select a category")').first();
            console.log("[promote-bot] Checking dropdown/select elements...");
            
            // Let's click the "Select a category" dropdown
            const categoryDropdown = page.locator('div:has-text("Select a category")').last();
            if (await categoryDropdown.count() > 0) {
                console.log("[promote-bot] Clicking category dropdown...");
                await categoryDropdown.click();
                await page.waitForTimeout(1500);
                
                // Let's screenshot to see options
                await page.screenshot({ path: resolve(rootDir, "category_dropdown_open.png") });
                console.log("[promote-bot] Dropdown options screenshot saved.");
                
                // Find "Productivity" or "Finance" options in the dropdown list
                // Google Play Console custom dropdowns are typically material-select or have role="option"
                const option = page.locator('span:has-text("Productivity"), div[role="option"]:has-text("Productivity"), [role="listbox"] [role="option"]:has-text("Productivity")').first();
                if (await option.count() > 0 && await option.isVisible()) {
                    console.log("[promote-bot] Found Productivity option! Clicking it...");
                    await option.click();
                } else {
                    console.log("[promote-bot] Productivity not found directly. Searching for option elements...");
                    const options = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('[role="option"], option, span'))
                            .map(el => el.innerText.trim())
                            .filter(t => t.length > 0 && t.length < 50);
                    });
                    console.log("[promote-bot] Found options:", options);
                    
                    // Fallback select Productivity or Finance or Business
                    const financeOption = page.locator('span:has-text("Finance"), [role="option"]:has-text("Finance")').first();
                    if (await financeOption.count() > 0) {
                        console.log("[promote-bot] Found Finance option. Clicking it...");
                        await financeOption.click();
                    } else {
                        const businessOption = page.locator('span:has-text("Business"), [role="option"]:has-text("Business")').first();
                        if (await businessOption.count() > 0) {
                            await businessOption.click();
                        }
                    }
                }
                await page.waitForTimeout(1000);
            }
            
            // Click Save button for Category card
            // In Store Settings, there's usually a main Save button at the bottom of the page, or per-card.
            // Let's see if card has Save/Apply button or if there's a global Save button.
            // In the screenshot/analysis we saw a global "Save" button with debugId: "main-button".
            // Let's scroll down to check.
        }

        // --- Step 2: Fill Contact Details ---
        console.log("[promote-bot] Clicking the second 'Edit' button for Contact Details...");
        if (editCount > 1) {
            await editButtons.nth(1).click();
            await page.waitForTimeout(2000);
            
            // Fill contact details inputs
            // Let's find all text inputs
            const textInputs = page.locator('input[type="text"]');
            const inputCount = await textInputs.count();
            console.log(`[promote-bot] Found ${inputCount} text inputs after clicking edit.`);
            
            // Let's find inputs based on their labels or preceding texts.
            // Email address is usually the first empty field or labeled as email.
            // In analysis:
            // Input 3: placeholder "Add filter" or search Search tags
            // Input 4: labels "      " (Email field)
            // Input 5: labels "      " (Phone number field)
            // Input 6: labels "  https://    " (Website field)
            // Let's inspect placeholders and labels more precisely using DOM properties
            const inputsInfo = await page.evaluate(() => {
                return Array.from(document.querySelectorAll("input[type='text'], input[type='email']")).map((el, i) => {
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
            console.log("[promote-bot] Available text/email inputs:", JSON.stringify(inputsInfo, null, 2));
            
            // We can target input fields by scanning parent text
            for (let i = 0; i < inputsInfo.length; i++) {
                const info = inputsInfo[i];
                const combinedText = (info.parentText + " " + info.grandText).toLowerCase();
                
                if (combinedText.includes("email")) {
                    console.log(`[promote-bot] Index ${info.index} looks like Email input. Filling it...`);
                    await textInputs.nth(info.index).fill("igor@iganapolsky.com");
                } else if (combinedText.includes("website") || combinedText.includes("https")) {
                    console.log(`[promote-bot] Index ${info.index} looks like Website input. Filling it...`);
                    await textInputs.nth(info.index).fill("iganapolsky.com"); // without https:// since it prefixing it, or let's see if prefix is separate
                } else if (combinedText.includes("phone")) {
                    console.log(`[promote-bot] Index ${info.index} looks like Phone input. Filling it...`);
                    await textInputs.nth(info.index).fill("+15555555555");
                }
            }
            await page.waitForTimeout(1000);
        }

        // --- Step 3: Save Changes ---
        // Let's find the save button at the bottom
        console.log("[promote-bot] Looking for global Save button...");
        const saveButton = page.locator('button:has-text("Save")').first();
        if (await saveButton.count() > 0) {
            const isDisabled = await saveButton.getAttribute("disabled");
            const isAriaDisabled = await saveButton.getAttribute("aria-disabled");
            console.log(`[promote-bot] Save button found. Disabled: ${isDisabled}, aria-disabled: ${isAriaDisabled}`);
            
            if (isDisabled !== "true" && isAriaDisabled !== "true") {
                console.log("[promote-bot] Clicking Save button...");
                await saveButton.click();
                await page.waitForTimeout(5000);
                console.log("[promote-bot] Save clicked. Waiting for save response...");
            } else {
                console.log("[promote-bot] Save button is disabled. Maybe some required fields are not filled, or no changes detected.");
            }
        } else {
            console.log("[promote-bot] Save button not found!");
        }

        const finalScreenshotPath = resolve(rootDir, "category_contact_completed.png");
        await page.screenshot({ path: finalScreenshotPath });
        console.log(`[promote-bot] Completed screenshot saved to ${finalScreenshotPath}`);

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
