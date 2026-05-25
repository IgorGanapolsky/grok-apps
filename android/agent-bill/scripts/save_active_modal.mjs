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

        // Print all button texts currently on the page
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("button"))
                .map(b => ({
                    text: b.innerText.trim(),
                    disabled: b.disabled,
                    visible: b.offsetWidth > 0 && b.offsetHeight > 0
                }));
        });
        console.log("[promote-bot] All buttons on page:", JSON.stringify(buttons, null, 2));

        // Find the "Save" button. Since the Category modal is open, let's find a visible button with text "Save"
        const saveButtons = page.locator('button:has-text("Save")');
        const count = await saveButtons.count();
        console.log(`[promote-bot] Found ${count} buttons matching "Save"`);

        let clicked = false;
        for (let i = 0; i < count; i++) {
            const btn = saveButtons.nth(i);
            if (await btn.isVisible()) {
                console.log(`[promote-bot] Save button at index ${i} is visible. Clicking it...`);
                await btn.click();
                clicked = true;
                break;
            }
        }

        if (!clicked) {
            console.log("[promote-bot] No visible Save button found. Let's try to click the last one anyway.");
            if (count > 0) {
                await saveButtons.last().click();
            } else {
                console.log("[promote-bot] No Save button found at all!");
            }
        }

        console.log("[promote-bot] Waiting 5 seconds for save...");
        await page.waitForTimeout(5000);

        await page.screenshot({ path: resolve(rootDir, "active_modal_saved.png") });
        console.log("[promote-bot] Screenshot saved as active_modal_saved.png");

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
