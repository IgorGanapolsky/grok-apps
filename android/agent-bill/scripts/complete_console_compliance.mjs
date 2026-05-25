import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const OVERVIEW_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/overview`;

async function run() {
    console.log("[compliance-bot] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        console.log(`[compliance-bot] Found ${pages.length} active tabs.`);
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("[compliance-bot] No Play Console tab found. Opening a new tab...");
            page = await ctx.newPage();
        } else {
            console.log(`[compliance-bot] Attaching directly to existing tab: "${await page.title()}"`);
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        // ==========================================
        // 1. FINANCIAL FEATURES DECLARATION
        // ==========================================
        console.log("\n[compliance-bot] --- 1. Processing Financial Features ---");
        const financeUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/finance`;
        console.log(`[compliance-bot] Navigating directly to Financial Features form: ${financeUrl}`);
        await page.goto(financeUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        // Capture screenshot of loaded form
        await page.screenshot({ path: resolve(rootDir, "financial_features_form_loaded.png") });
        console.log("[compliance-bot] Screenshot of form saved.");

        // Check if already completed or if we can click the checkbox
        const noFinancialCheckbox = page.locator('mat-checkbox:has-text("doesn\'t provide any financial features"), label:has-text("doesn\'t provide any financial features"), span:has-text("doesn\'t provide any financial features")').first();
        if (await noFinancialCheckbox.count() > 0) {
            console.log("[compliance-bot] Locating and clicking the 'My app doesn't provide any financial features' option...");
            await noFinancialCheckbox.click();
            await page.waitForTimeout(2000);

            // Click Save button
            console.log("[compliance-bot] Locating and clicking 'Save'...");
            const saveBtn = page.locator('button:has-text("Save"), button[debug-id="save-button"]').filter({ hasText: /Save/i }).first();
            if (await saveBtn.count() > 0) {
                if (await saveBtn.isEnabled()) {
                    await saveBtn.click();
                    console.log("[compliance-bot] Clicked Save! Waiting 5s...");
                    await page.waitForTimeout(5000);
                } else {
                    console.log("[compliance-bot] Save button is already disabled (no changes or already saved).");
                }
            } else {
                console.warn("[compliance-bot] Save button not found.");
            }

            // Click Next button to advance and Submit
            const nextBtn = page.locator('button:has-text("Next"), button[debug-id="next-button"]').first();
            if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
                console.log("[compliance-bot] Clicking Next...");
                await nextBtn.click();
                await page.waitForTimeout(3000);

                const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Save")').first();
                if (await submitBtn.count() > 0 && await submitBtn.isEnabled()) {
                    console.log("[compliance-bot] Clicking Submit / Save on final screen...");
                    await submitBtn.click();
                    await page.waitForTimeout(4000);
                }
            }
        } else {
            console.log("[compliance-bot] Financial features checkbox not found or form is already completed.");
        }

        await page.screenshot({ path: resolve(rootDir, "financial_features_completed.png") });
        console.log("[compliance-bot] Financial Features section completed successfully!");

        // Helper to navigate back to overview
        const ensureOverview = async () => {
            console.log(`[compliance-bot] Returning to Overview: ${OVERVIEW_URL}`);
            await page.goto(OVERVIEW_URL, { waitUntil: "networkidle" });
            await page.waitForTimeout(6000);
        };

        // Helper to click "Start declaration" for a specific section card
        const startDeclaration = async (cardHeadingText) => {
            await ensureOverview();
            console.log(`[compliance-bot] Looking for section: "${cardHeadingText}"...`);
            
            const heading = page.locator('simple-html[role="heading"], h3, h4').filter({ hasText: new RegExp("^" + cardHeadingText + "$", "i") }).first();
            if (await heading.count() === 0) {
                console.log(`[compliance-bot] Heading for "${cardHeadingText}" not found.`);
                return false;
            }

            const card = heading.locator('xpath=./ancestor::policy-summary[1]');
            const startBtn = card.locator('button:has-text("Start declaration"), button:has-text("Start rating"), button:has-text("Edit declaration"), button:has-text("Start questionnaire")').first();
            
            if (await startBtn.count() > 0 && await startBtn.isVisible()) {
                const btnText = await startBtn.innerText();
                console.log(`[compliance-bot] Found button: "${btnText}" in "${cardHeadingText}". Clicking it...`);
                await startBtn.click();
                await page.waitForTimeout(6000);
                console.log(`[compliance-bot] Current URL: ${page.url()}`);
                return true;
            } else {
                console.log(`[compliance-bot] No start button found for "${cardHeadingText}". Already completed?`);
                return false;
            }
        };

        // ==========================================
        // 2. ADVERTISING ID DECLARATION
        // ==========================================
        console.log("\n[compliance-bot] --- 2. Processing Advertising ID ---");
        const hasAdsDecl = await startDeclaration("Advertising ID");
        if (hasAdsDecl) {
            console.log("[compliance-bot] Completing Advertising ID form...");
            // Answer: No ads ID needed
            const noAdsRadio = page.locator('mat-radio-button:has-text("No"), label:has-text("No"), span:has-text("No")').first();
            if (await noAdsRadio.count() > 0) {
                await noAdsRadio.click();
                await page.waitForTimeout(1000);
            }

            const saveBtn = page.locator('button:has-text("Save"), button:has-text("Submit")').first();
            if (await saveBtn.count() > 0 && await saveBtn.isEnabled()) {
                await saveBtn.click();
                console.log("[compliance-bot] Saved Advertising ID declaration.");
                await page.waitForTimeout(4000);
            }
            await page.screenshot({ path: resolve(rootDir, "advertising_id_completed.png") });
        }

        // ==========================================
        // 3. GOVERNMENT APPS DECLARATION
        // ==========================================
        console.log("\n[compliance-bot] --- 3. Processing Government Apps ---");
        const hasGovDecl = await startDeclaration("Government apps");
        if (hasGovDecl) {
            console.log("[compliance-bot] Completing Government apps form...");
            // Answer: No, not a government app
            const noGovRadio = page.locator('mat-radio-button:has-text("No"), label:has-text("No"), span:has-text("No")').first();
            if (await noGovRadio.count() > 0) {
                await noGovRadio.click();
                await page.waitForTimeout(1000);
            }

            const saveBtn = page.locator('button:has-text("Save"), button:has-text("Submit")').first();
            if (await saveBtn.count() > 0 && await saveBtn.isEnabled()) {
                await saveBtn.click();
                console.log("[compliance-bot] Saved Government apps declaration.");
                await page.waitForTimeout(4000);
            }
            await page.screenshot({ path: resolve(rootDir, "government_apps_completed.png") });
        }

        // ==========================================
        // 4. HEALTH APPS DECLARATION
        // ==========================================
        console.log("\n[compliance-bot] --- 4. Processing Health Apps ---");
        const hasHealthDecl = await startDeclaration("Health apps");
        if (hasHealthDecl) {
            console.log("[compliance-bot] Completing Health apps form...");
            // Answer: My app doesn't provide any health features / No
            const noHealthCheckbox = page.locator('mat-checkbox:has-text("not provide"), label:has-text("not provide"), span:has-text("not provide"), mat-radio-button:has-text("No"), label:has-text("No")').first();
            if (await noHealthCheckbox.count() > 0) {
                await noHealthCheckbox.click();
                await page.waitForTimeout(1000);
            }

            const saveBtn = page.locator('button:has-text("Save"), button:has-text("Submit")').first();
            if (await saveBtn.count() > 0 && await saveBtn.isEnabled()) {
                await saveBtn.click();
                console.log("[compliance-bot] Saved Health apps declaration.");
                await page.waitForTimeout(4000);
            }
            await page.screenshot({ path: resolve(rootDir, "health_apps_completed.png") });
        }

        // ==========================================
        // 5. CONTENT RATINGS QUESTIONNAIRE
        // ==========================================
        console.log("\n[compliance-bot] --- 5. Processing Content Ratings ---");
        const hasRatings = await startDeclaration("Content ratings");
        if (hasRatings) {
            console.log("[compliance-bot] Completing Content Ratings questionnaire...");
            
            // Check if "Start questionnaire" button exists
            const startBtn = page.locator('button:has-text("Start questionnaire"), button:has-text("Start Ratings")').first();
            if (await startBtn.count() > 0 && await startBtn.isVisible()) {
                await startBtn.click();
                await page.waitForTimeout(4000);
            }

            // Fill Email and select category
            console.log("[compliance-bot] Filling email and category...");
            const emailInput = page.locator('input[type="email"], input[aria-label*="email"], input[aria-label*="Email"]').first();
            if (await emailInput.count() > 0) {
                await emailInput.fill("igor@iganapolsky.com");
                await page.waitForTimeout(1000);
            }

            // Category choice: "Utility, productivity, communication, or other"
            const utilityRadio = page.locator('mat-radio-button:has-text("Utility"), label:has-text("Utility"), mat-radio-button:has-text("productivity"), label:has-text("productivity")').first();
            if (await utilityRadio.count() > 0) {
                await utilityRadio.click();
                await page.waitForTimeout(1000);
            }

            // Click Next
            const nextBtn = page.locator('button:has-text("Next")').first();
            if (await nextBtn.count() > 0) {
                await nextBtn.click();
                await page.waitForTimeout(5000);
            }

            // Answer "No" to all questions on subsequent page(s)
            console.log("[compliance-bot] Answering 'No' to all survey questions...");
            let pageNum = 1;
            while (true) {
                const noRadios = page.locator('mat-radio-button:has-text("No"), label:has-text("No")');
                const noCount = await noRadios.count();
                if (noCount > 0) {
                    console.log(`[compliance-bot] Found ${noCount} 'No' options on questionnaire page #${pageNum}. Selecting all...`);
                    for (let i = 0; i < noCount; i++) {
                        await noRadios.nth(i).click();
                        await page.waitForTimeout(150);
                    }
                    await page.waitForTimeout(1000);
                    
                    // Click Save then Next
                    const saveBtn = page.locator('button:has-text("Save")').first();
                    if (await saveBtn.count() > 0 && await saveBtn.isEnabled()) {
                        await saveBtn.click();
                        await page.waitForTimeout(3000);
                    }

                    const nextBtn2 = page.locator('button:has-text("Next")').first();
                    if (await nextBtn2.count() > 0 && await nextBtn2.isEnabled()) {
                        await nextBtn2.click();
                        await page.waitForTimeout(4000);
                        pageNum++;
                    } else {
                        break;
                    }
                } else {
                    // No radio buttons, we might be on summary screen
                    console.log("[compliance-bot] No more question options. Checking for Calculate / Submit...");
                    break;
                }
            }

            // Final Submit/Save
            console.log("[compliance-bot] Finalizing Content Ratings rating...");
            const submitRatingBtn = page.locator('button:has-text("Save"), button:has-text("Submit"), button:has-text("Calculate"), button:has-text("Save rating")').first();
            if (await submitRatingBtn.count() > 0 && await submitRatingBtn.isEnabled()) {
                await submitRatingBtn.click();
                await page.waitForTimeout(4000);
                
                // If there's an extra Submit/Apply rating
                const applyBtn = page.locator('button:has-text("Submit"), button:has-text("Apply rating")').first();
                if (await applyBtn.count() > 0 && await applyBtn.isEnabled()) {
                    await applyBtn.click();
                    await page.waitForTimeout(4000);
                }
            }

            await page.screenshot({ path: resolve(rootDir, "content_rating_completed.png") });
            console.log("[compliance-bot] Content Rating completed successfully!");
        }

        // ==========================================
        // 6. APP ACCESS DECLARATION
        // ==========================================
        console.log("\n[compliance-bot] --- 6. Processing App Access ---");
        const hasAccess = await startDeclaration("App access");
        if (hasAccess) {
            console.log("[compliance-bot] Completing App Access form...");
            // Answer: All functionality is available without special access
            const allAccessRadio = page.locator('mat-radio-button:has-text("All functionality"), label:has-text("All functionality"), mat-radio-button:has-text("without special access"), label:has-text("without special access")').first();
            if (await allAccessRadio.count() > 0) {
                await allAccessRadio.click();
                await page.waitForTimeout(1000);
            }

            const saveBtn = page.locator('button:has-text("Save"), button:has-text("Submit")').first();
            if (await saveBtn.count() > 0 && await saveBtn.isEnabled()) {
                await saveBtn.click();
                console.log("[compliance-bot] Saved App Access declaration.");
                await page.waitForTimeout(4000);
            }
            await page.screenshot({ path: resolve(rootDir, "app_access_completed.png") });
        }

        // ==========================================
        // 7. VERIFICATION
        // ==========================================
        console.log("\n[compliance-bot] --- 7. Final Verification ---");
        await ensureOverview();
        await page.screenshot({ path: resolve(rootDir, "app_content_overview_state.png") });
        console.log("[compliance-bot] All compliance forms processed. Saved final App Content Overview screenshot.");

    } catch (e) {
        console.error("[compliance-bot] Error:", e.message);
        try {
            await page.screenshot({ path: resolve(rootDir, "compliance_error.png") });
        } catch (screenshotErr) {}
    } finally {
        await browser.close().catch(() => {});
        console.log("[compliance-bot] Complete.");
    }
}

run();
