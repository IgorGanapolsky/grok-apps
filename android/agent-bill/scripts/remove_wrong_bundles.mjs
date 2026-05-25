import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found.");
            return;
        }

        console.log(`Analyzing tab: "${await page.title()}"`);

        // Perform surgical removal of old/failed bundles inside the browser DOM
        const result = await page.evaluate(() => {
            const logs = [];
            
            // Find all buttons on the page
            const buttons = Array.from(document.querySelectorAll('button'));
            
            // 1. Remove App bundle 1 (failed version) if direct clear exists
            const clearBtn = buttons.find(b => {
                const txt = b.innerText ? b.innerText.trim() : "";
                const aria = b.getAttribute('aria-label') || "";
                return txt === "clear" && aria.includes("Remove");
            });
            
            if (clearBtn) {
                logs.push("Found 'clear' button for failed version (App bundle 1). Clicking it...");
                clearBtn.click();
            } else {
                logs.push("Could not find direct 'clear' button for App bundle 1.");
            }

            // 2. Locate App bundle 2 and App bundle 1 rows specifically
            const detailBtns = buttons.filter(b => {
                const aria = b.getAttribute('aria-label') || "";
                return aria.includes("View details for App bundle:");
            });

            detailBtns.forEach(dBtn => {
                const aria = dBtn.getAttribute('aria-label');
                logs.push(`Found detail button: "${aria}"`);
                
                if (aria.includes("App bundle: 2") || aria.includes("App bundle: 1")) {
                    // Find the remove button in the same section/row by climbing the tree
                    let row = dBtn.parentElement;
                    let removeBtn = null;
                    for (let i = 0; i < 5; i++) {
                        if (row) {
                            const rowBtns = Array.from(row.querySelectorAll('button'));
                            removeBtn = rowBtns.find(rb => {
                                const rbt = rb.innerText ? rb.innerText.trim() : "";
                                const rba = rb.getAttribute('aria-label') || "";
                                return rbt === "delete" || rbt === "clear" || rba.includes("Remove");
                            });
                            if (removeBtn && removeBtn !== dBtn) {
                                break;
                            }
                            row = row.parentElement;
                        }
                    }

                    if (removeBtn) {
                        logs.push(`Found remove button for "${aria}". Clicking it...`);
                        removeBtn.click();
                    } else {
                        logs.push(`Could not locate remove button for "${aria}" by DOM traversal.`);
                    }
                }
            });

            return logs;
        });

        console.log("\n--- DOM EXECUTION LOGS ---");
        result.forEach(l => console.log(l));
        console.log("--------------------------\n");

        // Wait 4 seconds for DOM update
        await page.waitForTimeout(4000);

        // Take a screenshot of the cleaned state
        const cleanedScreenshot = resolve(rootDir, "current_tab_cleaned.png");
        await page.screenshot({ path: cleanedScreenshot });
        console.log(`Saved cleaned state screenshot to: ${cleanedScreenshot}`);

        // Try to save and progress
        console.log("Locating Save/Next buttons...");
        const saveBtn = page.locator('button:has-text("Save as draft"), button:has-text("Save")').first();
        const nextBtn = page.locator('button:has-text("Next"), button:has-text("Review release")').first();

        const isSaveEnabled = await saveBtn.isEnabled();
        const isNextEnabled = await nextBtn.isEnabled();

        console.log(`Save button enabled: ${isSaveEnabled}`);
        console.log(`Next button enabled: ${isNextEnabled}`);

        if (isSaveEnabled) {
            console.log("Clicking Save as draft...");
            await saveBtn.click();
            await page.waitForTimeout(5000);
        }

        if (isNextEnabled) {
            console.log("Clicking Next...");
            await nextBtn.click();
            await page.waitForTimeout(6000);
            
            console.log("Success! Capturing rollout dashboard screenshot...");
            const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
            await page.screenshot({ path: finalScreenshot });
            console.log(`Saved rollout confirmation to: ${finalScreenshot}`);
        } else {
            // If Next is still not enabled, click Save first
            console.log("Next button not enabled yet. Attempting to click Save first...");
            if (await saveBtn.isVisible() && await saveBtn.isEnabled()) {
                await saveBtn.click();
                await page.waitForTimeout(5000);
                const nextBtnAgain = page.locator('button:has-text("Next"), button:has-text("Review release")').first();
                if (await nextBtnAgain.isEnabled()) {
                    console.log("Next is now enabled! Clicking it...");
                    await nextBtnAgain.click();
                    await page.waitForTimeout(6000);
                    const finalScreenshot = resolve(rootDir, "play_console_rollout_ready.png");
                    await page.screenshot({ path: finalScreenshot });
                    console.log(`Saved rollout confirmation to: ${finalScreenshot}`);
                } else {
                    console.log("Next button is still disabled after saving. Please check the page.");
                }
            }
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
