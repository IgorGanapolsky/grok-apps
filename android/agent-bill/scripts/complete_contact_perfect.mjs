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

        // Identify inputs inside the open contact details modal
        const textInputs = page.locator('input[type="text"], input[type="email"]');
        const count = await textInputs.count();
        console.log(`[promote-bot] Total inputs on page: ${count}`);

        // Get 5-depth ancestors for each text/email input on page
        const inputsInfo = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("input[type='text'], input[type='email'], input[type='tel']")).map((el, i) => {
                let parent = el.parentElement;
                let textAgg = "";
                for (let depth = 0; depth < 6; depth++) {
                    if (!parent) break;
                    if (parent.innerText) {
                        textAgg += " " + parent.innerText.trim();
                    }
                    parent = parent.parentElement;
                }
                return {
                    index: i,
                    textContext: textAgg.toLowerCase()
                };
            });
        });

        console.log("[promote-bot] Traversed text contexts:", JSON.stringify(inputsInfo, null, 2));

        // Let's populate the inputs based on matched ancestor context
        let filledCount = 0;
        for (let i = 0; i < inputsInfo.length; i++) {
            const info = inputsInfo[i];
            const context = info.textContext;
            const currentField = textInputs.nth(info.index);

            // Filter out elements that are actually not in the contact form
            if (context.includes("search tags") || context.includes("add filter")) {
                continue;
            }

            if (context.includes("email address")) {
                console.log(`[promote-bot] Filling Email address input at index ${info.index}...`);
                await currentField.fill("igor@iganapolsky.com");
                filledCount++;
            } else if (context.includes("phone number")) {
                console.log(`[promote-bot] Filling Phone number input at index ${info.index}...`);
                await currentField.fill("+12015550123");
                filledCount++;
            } else if (context.includes("website") || context.includes("https")) {
                console.log(`[promote-bot] Filling Website input at index ${info.index}...`);
                await currentField.fill("iganapolsky.com");
                filledCount++;
            }
        }

        console.log(`[promote-bot] Filled ${filledCount} contact fields.`);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: resolve(rootDir, "contact_details_filled_perfect.png") });

        // --- Step 3: Click Save on the contact card ---
        console.log("[promote-bot] Clicking Save button in contact details modal...");
        const saveBtn = page.locator('button:has-text("Save")').last();
        
        // Wait for it to become enabled
        await page.waitForTimeout(1000);
        const isDisabled = await saveBtn.getAttribute("disabled");
        console.log(`[promote-bot] Save button disabled attribute: ${isDisabled}`);

        await saveBtn.click();
        console.log("[promote-bot] Clicked Save. Waiting 5 seconds for save API response...");
        await page.waitForTimeout(5000);

        await page.screenshot({ path: resolve(rootDir, "contact_details_saved_perfect.png") });

        // --- Step 4: Dismiss "Go to Publishing overview?" ---
        console.log("[promote-bot] Checking for Publishing Overview popup...");
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
        console.log("[promote-bot] Contact details completely saved and modal dismissed!");

        // Final page screenshot
        await page.screenshot({ path: resolve(rootDir, "category_contact_completed_perfect.png") });
        console.log("[promote-bot] Final Settings screen saved to category_contact_completed_perfect.png");

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
